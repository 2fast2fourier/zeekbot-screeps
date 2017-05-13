"use strict";

var BaseAction = require('./base');

var offsets = {
    container: -1,
    storage: -1.25,
    link: -1.5,
};

class EnergyAction extends BaseAction {
    constructor(){
        super('energy');
    }

    postWork(cluster, creep, opts, action){
        var storage = creep.getStored();
        if(storage < creep.carryCapacity * 0.25){
            var containers = creep.room.lookForRadius(creep.pos, LOOK_STRUCTURES, 2);
            var targets = _.filter(containers, struct => (struct.structureType == STRUCTURE_CONTAINER || struct.structureType == STRUCTURE_STORAGE || struct.structureType == STRUCTURE_LINK) && struct.getResource(RESOURCE_ENERGY) > 0);
            var nearby = _.first(_.sortBy(targets, target => offsets[target.structureType] * Math.min(creep.carryCapacity, target.getResource(RESOURCE_ENERGY))));
            if(nearby){
                creep.withdraw(nearby, RESOURCE_ENERGY, Math.min(creep.getCapacity() - storage, nearby.getResource(RESOURCE_ENERGY)));
            }
        }
    }
}


module.exports = EnergyAction;