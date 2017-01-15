"use strict";

var BaseAction = require('./base');
var Util = require('../util');

var offsets = {
    container: -1,
    storage: -1.25,
    link: -1.5,
};

class EnergyAction extends BaseAction {
    constructor(catalog){
        super(catalog, 'energy');
    }

    postWork(creep, opts, action){
        var storage = Util.getStorage(creep);
        if(storage < creep.carryCapacity * 0.25){
            // var energy = this.catalog.lookForArea(creep.room, creep.pos, LOOK_ENERGY, 2);
            var containers = this.catalog.lookForArea(creep.room, creep.pos, LOOK_STRUCTURES, 2);
            var targets = _.filter(containers, struct => (struct.structureType == STRUCTURE_CONTAINER || struct.structureType == STRUCTURE_STORAGE || struct.structureType == STRUCTURE_LINK) && Util.getResource(struct, RESOURCE_ENERGY) > 0);
            var nearby = _.first(_.sortBy(targets, target => offsets[target.structureType] * Math.min(creep.carryCapacity, Util.getResource(target, RESOURCE_ENERGY))));
            if(nearby){
                creep.withdraw(nearby, RESOURCE_ENERGY, Math.min(Util.getCapacity(creep) - storage, Util.getResource(nearby, RESOURCE_ENERGY)));
            }
        }
    }
}


module.exports = EnergyAction;