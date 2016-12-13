"use strict";

var BaseJob = require('./base');

class BuildJob extends BaseJob {
    constructor(catalog){ super(catalog, 'build', { flagPrefix: 'Build' }); }

    calculateCapacity(room, target){
        return Math.min(Math.ceil((target.progressTotal - target.progress)/5), 40);
    }

    generateTargets(room){
        return room.find(FIND_MY_CONSTRUCTION_SITES);
    }

    // finalizeJob(room, target, job){
    //     return job;
    // }
}

module.exports = BuildJob;