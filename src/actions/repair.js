"use strict";

var BaseAction = require('./base');

class RepairAction extends BaseAction {
    constructor(catalog){
        super(catalog, 'repair');
    }

    postWork(creep, opts, action){
        if(!action && creep.carry.energy > creep.carryCapacity / 8){
            var structures = creep.room.lookForAtArea(LOOK_STRUCTURES, Math.max(0, creep.pos.y - 3), Math.max(0, creep.pos.x - 3), Math.min(49, creep.pos.y + 3), Math.min(49, creep.pos.x + 3), true);
            var targets = _.filter(structures, struct => struct.structure.hits < Math.min(struct.structure.hitsMax, Memory.settings.repairTarget));
            if(targets.length > 0){
                creep.repair(targets[0].structure);
            }
        }
    }
}


module.exports = RepairAction;