"use strict";

var BaseAction = require('./base');

class RepairAction extends BaseAction {
    constructor(){
        super('repair');
    }

    postWork(cluster, creep, opts, action){
        if(Memory.lockdown && Game.cpu.bucket < 7500){
            console.log('locking down', creep);
            creep.suicide();
        }
        if(Game.cpu.bucket < 9500){
            return;
        }
        if(!action && creep.carry.energy > creep.carryCapacity / 8){
            var structures = creep.room.lookForRadius(creep.pos, LOOK_STRUCTURES, 3);
            var targets = _.filter(structures, structure => structure.hits < structure.getMaxHits() && structure.mine());
            if(targets.length > 0){
                creep.repair(targets[0]);
            }
        }
    }
}


module.exports = RepairAction;