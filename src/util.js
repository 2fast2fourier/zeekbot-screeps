"use strict";

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

    static distanceReal(entityA){
        return function(entityB){
            return getRealDistance(entityA, entityB);
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
    
    static closestReal(entity, entities){
        return _.sortBy(entities, SortPredicates.distanceReal(entity));
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
    }
};