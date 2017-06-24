"use strict";

var BaseAction = require('./base');

var offsets = {
    container: -1,
    storage: -1.25,
    link: -1.5,
};

var filter = function(struct){
    return (struct.structureType == STRUCTURE_CONTAINER
                || struct.structureType == STRUCTURE_STORAGE
                || struct.structureType == STRUCTURE_LINK)
            && struct.getResource(RESOURCE_ENERGY) > 0;
}

class EnergyAction extends BaseAction {
    constructor(){
        super('energy');
    }

    postWork(cluster, creep, opts, action){
        var storage = creep.getStored();
        if(storage < creep.carryCapacity * 0.25){
            var target = false;
            if(creep.memory.energyPickup){
                target = Game.getObjectById(creep.memory.energyPickup);
            }
            if(!target || target.getResource(RESOURCE_ENERGY) == 0 || creep.pos.getRangeTo(target) > 1){
                var containers = creep.room.lookForRadius(creep.pos, LOOK_STRUCTURES, 2);
                var targets = _.filter(containers, filter);
                target = _.first(_.sortBy(targets, target => offsets[target.structureType] * Math.min(creep.carryCapacity, target.getResource(RESOURCE_ENERGY))));
                if(target){
                    creep.memory.energyPickup = target.id;
                }
            }
            if(target){
                creep.withdraw(target, RESOURCE_ENERGY, Math.min(creep.getCapacity() - storage, target.getResource(RESOURCE_ENERGY)));
            }
        }
    }
}


module.exports = EnergyAction;