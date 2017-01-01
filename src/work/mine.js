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
        if(creep.ticksToLive < 100){
            return Math.ceil(creep.getActiveBodyparts(WORK) / 2);
        }
        return creep.getActiveBodyparts(WORK);
    }

    calculateBid(creep, opts, job, allocation, distance){
        return this.catalog.getResourcePercent(creep, RESOURCE_ENERGY) + distance / this.distanceWeight;
    }

    processStep(creep, job, target, opts){
        this.orMove(creep, target, creep.harvest(target));
        if(creep.ticksToLive == 100){
            creep.memory.jobAllocation = Math.ceil(creep.memory.jobAllocation / 2);
        }
    }

}

module.exports = MineWorker;