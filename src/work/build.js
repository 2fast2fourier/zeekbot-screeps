"use strict";

var BaseWorker = require('./base');

class BuildWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'build', { requiresEnergy: true, chatty: true }); }

    calculateAllocation(creep, opts){
        return 1;
    }

    calculateBid(creep, opts, job, allocation, distance){
        return this.getEnergyOffset(creep) + distance / this.distanceWeight + job.offset;
    }

    processStep(creep, job, target, opts){
        this.orMove(creep, target, creep.build(target));
    }

}

module.exports = BuildWorker;