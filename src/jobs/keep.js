"use strict";

var BaseJob = require('./base');

class KeepJob extends BaseJob {
    constructor(catalog){ super(catalog, 'keep', { flagPrefix: 'Keep' }); }

    calculateCapacity(room, target){
        // var access = Math.min(2, this.catalog.getAccessibility(target.pos, room));
        // if(target.ticksToSpawn > 60 && target.ticksToSpawn < 100){
        //     return 15;
        // }else 
        if(target.ticksToSpawn >= 80 && target.ticksToSpawn < 280){
            return 0;
        }
        return 15;
        // return 15 * access;
    }

    generateTargets(room){
        return [];
    }

    generateJobsForFlag(flag){
        if(flag.room){
            var keeps = flag.room.find(FIND_HOSTILE_STRUCTURES);
            if(Memory.settings.flagRange.keep > 0){
                keeps = _.filter(keeps, keep => flag.pos.getRangeTo(keep) <= Memory.settings.flagRange.keep);
            }
            return _.map(keeps, target => this.finalizeJob(flag.room, target, this.generateJobForTarget(flag.room, target)));
        }else{
            return [ this.generateJobForTarget(flag.room, flag) ];
        }
    }

    finalizeJob(room, target, job){
        if(target.ticksToSpawn > 0){
            job.priority = target.ticksToSpawn/300;
        }else{
            job.priority = 0;
        }
        if(!(target.ticksToSpawn > 15 && target.ticksToSpawn < 295)){
            this.catalog.addAvoid(target.pos);
        }
        return job;
    }
}

module.exports = KeepJob;

