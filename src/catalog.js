"use strict";

var JobManager = require('./jobmanager');

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

        this.creeps = {
            class: _.groupBy(Game.creeps, creep => creep.memory.class),
            type: _.groupBy(Game.creeps, creep => creep.memory.type),
            room: _.groupBy(Game.creeps, creep => creep.pos.roomName)
        };

        this.rooms = _.filter(Game.rooms, 'controller.my');

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

    // getEnergyNeeds(creep, { ignoreCreeps, ignoreClass, containerTypes, maxRange, excludeRemote, maxStorage }){
    //     var types = [
    //         STRUCTURE_CONTAINER,
    //         STRUCTURE_EXTENSION,
    //         STRUCTURE_TOWER,
    //         STRUCTURE_LINK,
    //         STRUCTURE_STORAGE,
    //         STRUCTURE_SPAWN
    //     ];
    //     var containers = _.filter(this.buildings[creep.pos.roomName],
    //                               structure => _.includes(containerTypes || types, structure.structureType)
    //                                             && RoomUtil.getEnergyPercent(structure) < 1
    //                                             && (!maxStorage || RoomUtil.getEnergy(structure) < maxStorage)
    //                              );

    //     var filterClass = _.isArray(ignoreClass);
    //     if(filterClass || !ignoreCreeps){
    //         var targetCreeps = creep.room.find(FIND_MY_CREEPS, {
    //             filter: (target)=>!RoomUtil.energyFull(target) && (!filterClass || !_.includes(ignoreClass, target.memory.class))
    //         });

    //         if(excludeRemote){
    //             targetCreeps = _.filter(targetCreeps, creep => !creep.memory.remote);
    //         }

    //         if(targetCreeps.length > 0){
    //             containers = containers.concat(targetCreeps);
    //         }
    //     }
    //     if(maxRange > 0){
    //         containers = _.filter(containers, target => creep.pos.getRangeTo(target) <= maxRange);
    //     }

    //     return _.sortBy(containers, container => RoomUtil.getEnergyPercent(container) + creep.pos.getRangeTo(container)/50 + Catalog.getEnergyDeliveryOffset(container));
    // }

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

    getDroppedResources(room){
        if(!room.name){ return []; }
        if(!this.droppedResources[room.name]){
            this.droppedResources[room.name] = room.find(FIND_DROPPED_RESOURCES);
        }
        return this.droppedResources[room.name];
    }

    getResource(entity, type){
        if(!entity){
            return 0;
        }
        if(!type){
            type = RESOURCE_ENERGY;
        }
        if(entity.carryCapacity > 0){
            return entity.carry[type];
        }else if(entity.storeCapacity > 0){
            return entity.store[type];
        }else if(entity.energyCapacity > 0 && type === RESOURCE_ENERGY){
            return entity.energy;
        }else if(entity.resourceType && entity.resourceType == type && entity.amount > 0){
            return entity.amount;
        }
        return 0;
    }

    getCapacity(entity){
        if(!entity){
            return 0;
        }
        if(entity.carryCapacity > 0){
            return entity.carryCapacity;
        }else if(entity.storeCapacity > 0){
            return entity.storeCapacity;
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
        }else if(entity.energyCapacity > 0){
            return entity.energy;
        }else if(entity.resourceType && entity.resourceType == RESOURCE_ENERGY && entity.amount > 0){
            return entity.amount;
        }
        return 0;
    }

    isFull(entity){
        return this.getAvailableCapacity(entity) < 1;
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
}

module.exports = Catalog;