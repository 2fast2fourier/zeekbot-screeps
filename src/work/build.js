"use strict";

var BaseWorker = require('./base');

class BuildWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'build', { requiresEnergy: true, chatty: true }); }

    calculateAllocation(creep, opts){
        // if(creep.getActiveBodyparts(WORK) > 0){
        //     return Math.ceil(this.catalog.getResource(creep, RESOURCE_ENERGY)/5);
        // }
        return 1;
    }

    calculateBid(creep, opts, job, allocation, distance){
        return this.getEnergyOffset(creep) + distance / this.distanceWeight;
    }

    processStep(creep, job, target, opts){
        this.orMove(creep, target, creep.build(target));
    }

}

module.exports = BuildWorker;