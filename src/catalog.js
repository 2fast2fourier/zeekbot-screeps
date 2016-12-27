"use strict";

var JobManager = require('./jobmanager');

var roomRegex = /([WE])(\d+)([NS])(\d+)/;

class Catalog {
    constructor(){
        this.types = {
            collect: [ STRUCTURE_CONTAINER ],
            dropoff: [ STRUCTURE_STORAGE ],
            energy: [ STRUCTURE_STORAGE, STRUCTURE_CONTAINER, STRUCTURE_LINK ],
            allResources: [ STRUCTURE_STORAGE, STRUCTURE_CONTAINER, STRUCTURE_TERMINAL, STRUCTURE_LAB, STRUCTURE_LINK ],
            spawn: [ STRUCTURE_SPAWN, STRUCTURE_EXTENSION ],
            energyNeeds: [ STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_STORAGE ],
            storage: [ STRUCTURE_STORAGE, STRUCTURE_CONTAINER ],
            walls: [ STRUCTURE_WALL, STRUCTURE_RAMPART ]
        };

        this.structures = {};
        this.hostile = {
            structures: {},
            creeps: {}
        };

        this.roomData = {};
        // roomData: {
        //     energy,
        //     minerals,
        //     mineralAmount,
        //     mineralType,
        //     sources,
        //     sourceEnergy
        // }

        this.droppedResources = {};
        this.storedResources = {};
        this.labResources = {};

        this.flagsPrefix = {};

        this.creeps = {
            class: _.groupBy(Game.creeps, creep => creep.memory.class),
            type: _.groupBy(Game.creeps, creep => creep.memory.type),
            room: _.groupBy(Game.creeps, creep => creep.pos.roomName)
        };

        this.buildings = _.groupBy(Game.structures, structure => structure.structureType);
        // _.forEach(this.buildings, (list, type)=>console.log(type, list.length));

        this.rooms = _.filter(Game.rooms, 'controller.my');
        this.avoid = {};

        this.jobs = new JobManager(this);

        //class
        this.deficits = {};

    }

    getRoomData(room){
        if(!room.name){
            return false;
        }
        if(!this.roomData[room.name]){
            var minerals = room.find(FIND_MINERALS);
            var sources = room.find(FIND_SOURCES);
            this.roomData[room.name] = {
                energy: _.reduce(this.getResourceContainers(room, this.types.energyContainers, RESOURCE_ENERGY), (result, structure) => result += this.getResource(structure, RESOURCE_ENERGY), 0),
                minerals,
                mineralAmount: _.reduce(minerals, (result, mineral) => result += mineral.mineralAmount, 0),
                mineralType: _.get(minerals, '[0].mineralType', false),
                sources,
                sourceEnergy: _.reduce(sources, (result, source) => result += source.energy, 0)
            };
        }
        return this.roomData[room.name];
    }

    getFlagsByPrefix(prefix){
        if(!this.flagsPrefix[prefix]){
            this.flagsPrefix[prefix] = _.filter(Game.flags, flag => flag.name.startsWith(prefix));
        }
        return this.flagsPrefix[prefix];
    }

    getStructures(room){
        if(!room.name){ return []; }
        if(!this.structures[room.name]){
            this.structures[room.name] = room.find(FIND_STRUCTURES);
        }
        return this.structures[room.name];
    }

    getStructuresByType(room, type){
        if(_.isArray(type)){
            return _.filter(this.getStructures(room), structure => _.includes(type, structure.structureType));
        }
        return _.filter(this.getStructures(room), structure => structure.structureType == type);
    }

    getFirstBuilding(room, type){
        return _.first(_.filter(this.structures[room.name], structure => structure.structureType == type));
    }

    getHostiles(room){
        return this.getHostileCreeps(room).concat(this.getHostileStructures(room));
    }

    getHostileCreeps(room){
        if(!this.hostile.creeps[room.name]){
            this.hostile.creeps[room.name] = room.find(FIND_HOSTILE_CREEPS);
        }
        return this.hostile.creeps[room.name];
    }

    getHostileStructures(room){
        if(!this.hostile.structures[room.name]){
            this.hostile.structures[room.name] = room.find(FIND_HOSTILE_STRUCTURES);
        }
        return this.hostile.structures[room.name];
    }

    getCreeps(room){
        if(!room.name){ return []; }
        return this.creeps.room[room.name];
    }

    getResourceContainers(room, containerTypes, resourceType){
        if(!room.name){ return []; }
        if(!resourceType){
            resourceType = RESOURCE_ENERGY;
        }
        var containers = _.filter(this.getStructuresByType(room, containerTypes || this.types.storage), structure => this.getResource(structure, resourceType) > 0);
        return containers.concat(_.filter(this.getDroppedResources(room), { resourceType }));
    }

    getStorageContainers(resourceType){
        if(!resourceType){
            resourceType = RESOURCE_ENERGY;
        }
        return _.filter(this.buildings.storage.concat(this.buildings.terminal), structure => this.getResource(structure, resourceType) > 0);
    }

    getDroppedResources(room){
        if(!room.name){ return []; }
        if(!this.droppedResources[room.name]){
            this.droppedResources[room.name] = room.find(FIND_DROPPED_RESOURCES);
        }
        return this.droppedResources[room.name];
    }

    getTotalStored(resource){
        var total = _.get(this.storedResources, resource, false);
        if(total === false){
            var containers = this.getStorageContainers(resource);
            total = _.reduce(containers, (result, container) => result + this.getResource(container, resource), 0);
            this.storedResources[resource] = total;
        }
        return total;
    }

    getTotalLabResources(resource){
        var total = _.get(this.labResources, resource, false);
        if(total === false){
            var containers = _.filter(this.buildings.lab, structure => this.getResource(structure, resource) > 0);
            total = _.reduce(containers, (result, container) => result + this.getResource(container, resource), 0);
            this.labResources[resource] = total;
        }
        return total;
    }

    getResource(entity, type){
        if(!entity){
            return 0;
        }
        if(!type){
            type = RESOURCE_ENERGY;
        }
        if(entity.carryCapacity > 0){
            return _.get(entity.carry, type, 0);
        }else if(entity.storeCapacity > 0){
            return _.get(entity.store, type, 0);
        }else if(entity.mineralCapacity > 0 && type === entity.mineralType){
            return entity.mineralAmount;
        }else if(entity.energyCapacity > 0 && type === RESOURCE_ENERGY){
            return entity.energy;
        }else if(entity.resourceType && entity.resourceType == type && entity.amount > 0){
            return entity.amount;
        }
        return 0;
    }

    getResourceList(entity){
        var result = {};
        if(!entity){
            return result;
        }
        if(entity.carryCapacity > 0){
            return _.pick(entity.carry, amount => amount > 0);
        }else if(entity.storeCapacity > 0){
            return _.pick(entity.store, amount => amount > 0);
        }else if(entity.mineralCapacity > 0 && entity.mineralAmount > 0){
            result[entity.mineralType] = entity.mineralAmount;
        }else if(entity.energyCapacity > 0 && entity.energy > 0){
            result[RESOURCE_ENERGY] = entity.energy;
        }else if(entity.resourceType && entity.amount > 0){
            result[entity.resourceType] = entity.amount;
        }
        return result;
    }

    getCapacity(entity){
        if(!entity){
            return 0;
        }
        if(entity.carryCapacity > 0){
            return entity.carryCapacity;
        }else if(entity.storeCapacity > 0){
            return entity.storeCapacity;
        }else if(entity.mineralCapacity > 0){
            return entity.mineralCapacity;
        }else if(entity.energyCapacity > 0){
            return entity.energyCapacity;
        }else if(entity.resourceType && entity.amount > 0){
            return entity.amount;
        }
        return 0;
    }
    
    getStorage(entity){
        if(!entity){
            return 0;
        }
        if(entity.carryCapacity > 0){
            return _.sum(entity.carry);
        }else if(entity.storeCapacity > 0){
            return _.sum(entity.store);
        }else if(entity.mineralCapacity > 0){
            return entity.mineralAmount;
        }else if(entity.energyCapacity > 0){
            return entity.energy;
        }else if(entity.resourceType && entity.amount > 0){
            return entity.amount;
        }
        return 0;
    }

    isFull(entity){
        return this.getAvailableCapacity(entity) < 1;
    }

    notFull(entity){
        return this.getAvailableCapacity(entity) > 0;
    }

    getAvailableCapacity(entity){
        return this.getCapacity(entity) - this.getStorage(entity);
    }

    getStoragePercent(entity){
        return this.getStorage(entity) / this.getCapacity(entity);
    }

    getResourcePercent(entity, type){
        return this.getResource(entity, type) / this.getCapacity(entity);
    }

    isCreep(entity){
        return entity.carryCapacity > 0;
    }

    hasMinerals(entity){
        return this.getStorage(entity) > this.getResource(entity, RESOURCE_ENERGY);
    }

    cacheRoomPos(pos){
        console.log('cacheRoomPos', pos.roomName);
        var roomParts = roomRegex.exec(pos.roomName);
        if(!roomParts){
            console.log('could not parse room', pos.roomName);
            return false;
        }
        var north = roomParts[3] == 'N';
        var east = roomParts[1] == 'E';
        //     1    2    3     4
        // /([WE])(\d+)([NS])(\d+)/
        var xSign = east ? 1 : -1;
        var ySign = north ? 1 : -1;
        var xOffset = east ? 0 : 50;
        var yOffset = north ? 50 : 0;
        Memory.cache.roompos[pos.roomName] = {
            x: _.parseInt(roomParts[2]) * 50 * xSign + xSign * xOffset,
            y: _.parseInt(roomParts[4]) * 50 * ySign + yOffset,
            ySign
        };
        return Memory.cache.roompos[pos.roomName];
    }

    calculateRealPosition(pos){
        if(!Memory.cache){
            Memory.cache = { roompos: {} };
        }
        var roompos = Memory.cache.roompos[pos.roomName];
        if(!roompos){
            roompos = this.cacheRoomPos(pos);
        }
        return {
            x: roompos.x + pos.x,
            y: roompos.y + pos.y * -roompos.ySign
        };
    }

    getRealDistance(entityA, entityB){
        if(!entityA.pos || !entityB.pos){
            console.log('invalid positions', entityA, entityB);
            return Infinity;
        }
        var posA = this.calculateRealPosition(entityA.pos);
        var posB = this.calculateRealPosition(entityB.pos);
        return Math.max(Math.abs(posA.x - posB.x), Math.abs(posA.y-posB.y));
    }

    sortByDistance(entity, targets){
        return _.sortBy(targets, target => this.getRealDistance(entity, target));
    }

    addAvoid(pos){
        if(!_.has(this.avoid, pos.roomName)){
            this.avoid[pos.roomName] = [];
        }
        this.avoid[pos.roomName].push(pos);
    }

    getAvoid(pos){
        return this.avoid[pos.roomName];
    }
}

module.exports = Catalog;