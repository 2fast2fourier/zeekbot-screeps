"use strict";

class SortPredicates {

    static storage(entity){
        return entity.getStorage();
    }

    static capacity(entity){
        return entity.getCapacity() - entity.getStorage();
    }

    static resource(type){
        return function(entity){
            return entity.getResource(type);
        }
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

module.exports = {
    sort: Sorting,
    predicates: {
        sort: SortPredicates
    }
};