"use strict";

var BaseJob = require('./base');

class KeepJob extends BaseJob {
    constructor(catalog){ super(catalog, 'keep', { flagPrefix: 'Keep' }); }

    calculateCapacity(room, target){
        return 15;
    }

    generateTargets(room){
        return [];
    }

    generateJobsForFlag(flag){
        if(flag.room){
            var keeps = flag.room.find(FIND_HOSTILE_STRUCTURES);
            if(Memory.settings.keepFlagRange > 0){
                keeps = _.filter(keeps, keep => flag.pos.getRangeTo(keep) <= Memory.settings.keepFlagRange);
            }
            return _.map(keeps, target => this.generateJobForTarget(flag.room, target));
        }else{
            return [ this.generateJobForTarget(flag.room, flag) ];
        }
    }
}

module.exports = KeepJob;

