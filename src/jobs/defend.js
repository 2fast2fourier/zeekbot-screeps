"use strict";

var BaseJob = require('./base');

class DefendJob extends BaseJob {
    constructor(catalog){ super(catalog, 'defend', { flagPrefix: 'Defend' }); }

    calculateCapacity(room, target){
        return 100;
    }

    generateTargets(room){
        _.set(Memory.stats.rooms, [room.name, 'hostileCount'], 0);
        return this.catalog.getHostileCreeps(room);
    }

    finalizeJob(room, target, job){
        job.keeper = _.get(target, 'owner.username', false) == 'Source Keeper';
        if(!job.keeper){
            Memory.stats.rooms[room.name].hostileCount++;
        }
        return job;
    }
}

module.exports = DefendJob;

