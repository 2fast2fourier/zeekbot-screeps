"use strict";

var BaseWorker = require('./base');

class MineWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'mine'); }

    isValid(creep, opts, job, target){
        return this.catalog.getAvailableCapacity(creep) > 0;
    }

    canBid(creep, opts){
        return !this.catalog.isFull(creep);
    }

    calculateAllocation(creep, opts){
        return creep.getActiveBodyparts(WORK);
    }

    calculateBid(creep, opts, job, allocation, distance){
        // var availableRatio = this.calcAvailRatio(job, allocation);
        return this.catalog.getResourcePercent(creep, RESOURCE_ENERGY) + distance / this.distanceWeight;
    }

    processStep(creep, job, target, opts){
        if(creep.harvest(target) == ERR_NOT_IN_RANGE){
            creep.moveTo(target);
        }
    }

}

module.exports = MineWorker;