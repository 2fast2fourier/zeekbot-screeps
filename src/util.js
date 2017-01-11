"use strict";

function getCapacity(entity){
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
    
function getStorage(entity){
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

function getResource(entity, type){
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

function getResourceList(entity){
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

function interval(num){
    return Game.time % num == 0;
}

class FilterPredicates {

    static empty(entity){
        return getStorage(entity) == 0;
    }

    static notFull(entity){
        return getStorage(entity) < getCapacity(entity);
    }

    static type(type){
        return function(entity){
            return entity.structureType == type;
        }
    }

    static notType(type){
        return function(entity){
            return entity.structureType != type;
        }
    }

    static types(types){
        return function(entity){
            return _.includes(types, entity.structureType);
        }
    }

    static full(entity){
        return getStorage(entity) >= getCapacity(entity);
    }
}

class SortPredicates {
    static distance(entityA){
        return function(entityB){
            return entityA.pos.getRangeTo(entityB);
        }
    }

    static storage(entity){
        return getStorage(entity);
    }

    static capacity(entity){
        return getCapacity(entity) - getStorage(entity);
    }

    static resource(type){
        return function(entity){
            return getResource(entity, type);
        }
    }
}

class Filters {
    static notFull(entities){
        return _.filter(entities, FilterPredicates.notFull);
    }
}

class Sorting {
    static resource(entities, type){
        return _.sortBy(entities, SortPredicates.resource(type));
    }
    
    static closest(entity, entities){
        return _.sortBy(entities, SortPredicates.distance(entity));
    }
}

class Helpers {

    static closestNotFull(entity, entities){
        return _.sortBy(_.filter(entities, FilterPredicates.notFull), SortPredicates.distance(entity));
    }

    static firstNotFull(entities){
        return _.first(_.filter(entities, FilterPredicates.notFull));
    }
}

module.exports = {
    filter: Filters,
    sort: Sorting,
    helper: Helpers,
    predicates: {
        filter: FilterPredicates,
        sort: SortPredicates
    },
    getCapacity,
    getStorage,
    getResource,
    getResourceList,
    interval
};