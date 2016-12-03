"use strict";

class RoomUtil {
    static exists(id){
        return id != null && id != false && Game.getObjectById(id) != null;
    }

    static prioritizeSources(room){
        var sources = room.find(FIND_SOURCES);
        var currentHarvesters = room.find(FIND_MY_CREEPS, {
            filter: (creep)=>!!creep.memory.traits.mining
        });
        var usage = _.countBy(currentHarvesters, function(harv){
            return harv.memory.traits.mining;
        });
        _.forEach(usage, function(use, id){
            var capacity = _.get(Memory.sourceCapacity, id, 1);
            if(use >= capacity){
                usage[id] = 999 - capacity;
            }
        });
        var leastId = sources[0].id;
        var leastCount = _.get(usage, sources[0].id, 0);
        _.forEach(sources, function(source){
            if(!usage[source.id] || leastCount > usage[source.id]){
                leastId = source.id;
                leastCount = usage[source.id] || 0;
            }
        });
        return leastId;
    }

    static calculateSourceEnergy(room){
        var energy = 0;
        var sources = room.find(FIND_SOURCES);
        _.forEach(sources, source => energy += source.energy);
        return energy;
    }

    static onEdge(pos){
        return pos.x < 1 || pos.x > 48 || pos.y < 1 || pos.y > 48;
    }

    static energyFull(entity){
        return !(RoomUtil.getEnergy(entity) < RoomUtil.getEnergyCapacity(entity));
    }

    static getEnergyPercent(entity){
        if(entity.carryCapacity > 0){
            return entity.carry.energy / entity.carryCapacity;
        }else if(entity.storeCapacity > 0){
            return entity.store[RESOURCE_ENERGY] / entity.storeCapacity;
        }else if(entity.energyCapacity > 0){
            return entity.energy / entity.energyCapacity;
        }else if(entity.resourceType && entity.resourceType == RESOURCE_ENERGY && entity.amount > 0){
            return Math.min(entity.amount, 1);
        }
        return 0;
    }

    static getEnergy(entity){
        if(entity.carryCapacity > 0){
            return entity.carry.energy;
        }else if(entity.storeCapacity > 0){
            return entity.store[RESOURCE_ENERGY];
        }else if(entity.energyCapacity > 0){
            return entity.energy;
        }else if(entity.resourceType && entity.resourceType == RESOURCE_ENERGY && entity.amount > 0){
            return entity.amount;
        }
        return 0;
    }

    static getEnergyCapacity(entity){
        if(entity.carryCapacity > 0){
            return entity.carryCapacity;
        }else if(entity.storeCapacity > 0){
            return entity.storeCapacity;
        }else if(entity.energyCapacity > 0){
            return entity.energyCapacity;
        }else if(entity.resourceType && entity.resourceType == RESOURCE_ENERGY && entity.amount > 0){
            return entity.amount;
        }
        return 0;
    }

    static getEnergyDeficit(entity){
        return RoomUtil.getEnergyCapacity(entity) - RoomUtil.getEnergy(entity);
    }

    static findEnergyNeeds(room, creep, ignoreContainers){
        var needs;
        if(ignoreContainers){
            needs = room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_EXTENSION ||
                                structure.structureType == STRUCTURE_SPAWN ||
                                structure.structureType == STRUCTURE_TOWER) &&
                            RoomUtil.getEnergyPercent(structure) < 1;
                    }
            });
        }else{
            needs = room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_EXTENSION ||
                                structure.structureType == STRUCTURE_SPAWN ||
                                structure.structureType == STRUCTURE_TOWER ||
                                structure.structureType == STRUCTURE_CONTAINER) &&
                            RoomUtil.getEnergyPercent(structure) < 1;
                    }
            });
        }
        if(creep){
            needs = _.sortBy(needs, (target)=>creep.pos.getRangeTo(target));
        }
        return needs;
    }
    
    static getEnergyPriority(type){
        if(!type){
            return 1;
        }
        var priorities = {
            'spawn': 0.5,
            'extension': 1.25,
            'tower': -1,
            'container': 1.5,
            'storage': 10,
            'link': 1.5
        };
        return _.get(priorities, type, 1);
    }

    static findFreeMiningId(room, creep, catalog){
        //TODO balance, find max capacity, ect
        return RoomUtil.prioritizeSources(room);
    }
}

module.exports = RoomUtil;