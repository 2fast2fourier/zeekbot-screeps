"use strict";

class SortPredicates {

    static storage(entity){
        return entity.getStorage();
    }

    static capacity(entity){
        return entity.getCapacity() - entity.getStored();
    }

    static distance(target){
        return function(entity){
            return entity.pos.getLinearDistance(target);
        }
    }

    static distancePath(target){
        return function(entity){
            return entity.pos.getPathDistance(target);
        }
    }

    static resource(type){
        return function(entity){
            return entity.getResource(type);
        }
    }
}

class Sorting {
    static resource(type, entities){
        return _.sortBy(entities, SortPredicates.resource(type));
    }
    
    static closest(entity, entities){
        return _.sortBy(entities, SortPredicates.distance(entity));
    }
    
    static closestPath(entity, entities){
        return _.sortBy(entities, SortPredicates.distancePath(entity));
    }
}

module.exports = {
    sort: Sorting,
    predicates: {
        sort: SortPredicates
    }
};