"use strict";

var BaseWorker = require('./base');

class PickupWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'pickup'); }

    isValid(creep, opts, job, target){
        return !this.catalog.isFull(creep) && this.catalog.getResource(target, RESOURCE_ENERGY) > 0;
    }

    canBid(creep, opts){
        return !this.catalog.isFull(creep);
    }

    calculateAllocation(creep, opts){
        return creep.getActiveBodyparts(CARRY);
    }

    calculateBid(creep, opts, job, allocation, distance){
        var availableRatio = this.calcAvailRatio(job, allocation);
        return 1 + this.getEnergyOffset(creep) + distance / this.distanceWeight + availableRatio;
    }

    processStep(creep, job, target, opts){
        var result;
        if(target.resourceType){
            result = creep.pickup(target);
        }else{
            result = creep.withdraw(target, RESOURCE_ENERGY);
        }
        if(result == ERR_NOT_IN_RANGE){
            creep.moveTo(target);
        }
    }

}

module.exports = PickupWorker;