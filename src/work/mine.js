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
        if(creep.memory.boosted && creep.memory.boosted.XUHO2 > 0){
            return 7;
        }
        return creep.getActiveBodyparts(WORK);
    }

    calculateBid(creep, opts, job, allocation, distance){
        return this.catalog.getResourcePercent(creep, RESOURCE_ENERGY) + distance / this.distanceWeight;
    }

    processStep(creep, job, target, opts){
        this.orMove(creep, target, creep.harvest(target));
    }

}

module.exports = MineWorker;