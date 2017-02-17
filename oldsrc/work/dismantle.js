"use strict";

var BaseWorker = require('./base');

class DismantleWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'dismantle'); }

    calculateAllocation(creep, opts){
        return creep.getActiveBodyparts(WORK) * 50 * creep.ticksToLive;
    }

    calculateBid(creep, opts, job, allocation, distance){
        return distance / this.distanceWeight;
    }

    processStep(creep, job, target, opts){
        this.orMove(creep, target, creep.dismantle(target));
    }

}

module.exports = DismantleWorker;