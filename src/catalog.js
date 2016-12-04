"use strict";

var RoomUtil = require('./roomutil');

class Catalog {
    constructor(){
        this.traits = {};
        this.buildings = {};
        this.hostiles = {};
        this.hostileStructures = {};
        this.energy = {};
        this.creeps = {};
        this.classCounts = {};
        this.creepTypes = {};
        this.deficitCounts = {};
        this.deficits = {};
        
        _.forEach(Game.creeps, creep => {
            var roomName = creep.pos.roomName;
            _.forEach(creep.memory.traits, (value, trait) => this.addTrait(creep, trait, value));
            if(!this.hostiles[roomName]){
                this.hostiles[roomName] = creep.room.find(FIND_HOSTILE_CREEPS);
            }
            if(!this.buildings[roomName]){
                this.buildings[roomName] = creep.room.find(FIND_STRUCTURES);
            }
            if(!this.hostileStructures[roomName]){
                this.hostileStructures[roomName] = creep.room.find(FIND_HOSTILE_STRUCTURES);
            }
            if(this.energy[roomName] === undefined){
                this.energy[roomName] = this.calculateEnergy(creep);
            }
        });

        this.traitCount = _.mapValues(this.traits, list => _.size(list));
        this.classCount = _.countBy(Game.creeps, creep => creep.memory.class);
        this.remoteCreeps = _.filter(Game.creeps, creep => creep.memory.remote);
        this.remoteClassCount = _.countBy(this.remoteCreeps, creep => creep.memory.class);
        this.remoteTypeCount = _.countBy(this.remoteCreeps, creep => creep.memory.type);
    }

    calculateEnergy(creep){
        var energy = 0;
        _.forEach(this.getEnergyContainers(creep), structure => energy += RoomUtil.getEnergy(structure));
        _.forEach(creep.room.find(FIND_DROPPED_ENERGY), resource => energy += RoomUtil.getEnergy(resource));
        return energy;
    }

    addTrait(creep, trait, value){
        if(!this.traits[trait]){
            this.traits[trait] = {};
        }
        if(value !== false){
            this.traits[trait][creep.id] = value;
        }
    }

    removeTrait(creep, trait){
        if(this.traits[trait] && this.traits[trait][creep.id]){
            delete this.traits[trait][creep.id];
        }
        this.traitCount = _.mapValues(this.traits, list => _.size(list));
    }

    getAvailableEnergy(creep){
        return this.energy[creep.pos.roomName];
    }

    getEnergyContainers(creep, containerTypes){
        var creepEnergyNeed = RoomUtil.getEnergyDeficit(creep);
        var types = [
            STRUCTURE_CONTAINER,
            STRUCTURE_LINK,
            STRUCTURE_STORAGE
        ];
        var containers = _.filter(this.buildings[creep.pos.roomName], structure => _.includes(containerTypes || types, structure.structureType) && RoomUtil.getEnergy(structure) > 0);
        containers = containers.concat(creep.room.find(FIND_DROPPED_ENERGY));
        return _.sortBy(containers, container => ((1 - Math.min(1, RoomUtil.getEnergy(container)/creepEnergyNeed)) + creep.pos.getRangeTo(container)/50) * Catalog.getEnergyPickupPriority(container));
    }

    getEnergyNeeds(creep, { ignoreCreeps, ignoreClass, containerTypes, maxRange, excludeRemote }){
        var types = [
            STRUCTURE_CONTAINER,
            STRUCTURE_EXTENSION,
            STRUCTURE_TOWER,
            STRUCTURE_LINK,
            STRUCTURE_STORAGE,
            STRUCTURE_SPAWN
        ];
        var containers = _.filter(this.buildings[creep.pos.roomName], structure => _.includes(containerTypes || types, structure.structureType) && RoomUtil.getEnergyPercent(structure) < 1);

        var filterClass = _.isArray(ignoreClass);
        if(filterClass || !ignoreCreeps){
            var targetCreeps = creep.room.find(FIND_MY_CREEPS, {
                filter: (target)=>!RoomUtil.energyFull(target) && (!filterClass || !_.includes(ignoreClass, target.memory.class))
            });

            if(excludeRemote){
                targetCreeps = _.filter(targetCreeps, creep => !creep.memory.remote);
            }

            if(targetCreeps.length > 0){
                containers = containers.concat(targetCreeps);
            }
        }
        if(maxRange > 0){
            containers = _.filter(containers, target => creep.pos.getRangeTo(target) <= maxRange);
        }

        return _.sortBy(containers, container => (RoomUtil.getEnergyPercent(container) + creep.pos.getRangeTo(container)/50) * Catalog.getEnergyDeliveryPriority(container));
    }

    getBuildings(creep, type){
        if(_.isArray(type)){
            return _.filter(this.buildings[creep.pos.roomName], structure => _.includes(type, structure.structureType));
        }
        if(_.isString(type)){
            return _.filter(this.buildings[creep.pos.roomName], structure => structure.structureType == type);
        }
        return this.buildings[creep.pos.roomName];
    }

    getHostiles(room){
        return this.hostiles[room.name].concat(this.hostileStructures[room.name]);
    }

    getHostileCreeps(room){
        return this.hostiles[room.name];
    }

    getHostileStructures(room){
        return this.hostileStructures[room.name];
    }

    getCreeps(room){
        if(!this.creeps[room.name]){
            this.creeps[room.name] = room.find(FIND_MY_CREEPS);
        }
        return this.creeps[room.name];
    }

    getLocalCreeps(room){
        return _.filter(this.getCreeps(room), creep => !creep.memory.remote);
    }

    getClassCount(room){
        if(!this.classCounts[room.name]){
            this.classCounts[room.name] = _.countBy(this.getLocalCreeps(room), creep => creep.memory.class);
        }
        return this.classCounts[room.name];
    }

    getTypeCount(room){
        if(!this.creepTypes[room.name]){
            this.creepTypes[room.name] = _.countBy(this.getLocalCreeps(room), creep => creep.memory.type);
        }
        return this.creepTypes[room.name];
    }

    
    
    static getEnergyPickupPriority(target){
        if(target.amount > 0){
            return Math.max(0, 1 - target.amount / 200);
        }
        if(!target.structureType){
            return 1;
        }
        var priorities = {
            'container': 1,
            'storage': 100,
            'link': 1
        };
        return _.get(priorities, target.structureType, 1);
    }
    
    static getEnergyDeliveryPriority(target){
        if(!target.structureType){
            return 1;
        }
        var priorities = {
            'spawn': 0.25,
            'extension': 0.25,
            'tower': 0.5,
            'container': 1.5,
            'storage': 5,
            'link': 20
        };
        return _.get(priorities, target.structureType, 1);
    }
}

module.exports = Catalog;