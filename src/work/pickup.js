"use strict";

var BaseWorker = require('./base');

class PickupWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'pickup'); }

    isValid(creep, opts, job, target){
        return !this.catalog.isFull(creep) && this.catalog.getResource(target, job.resource) > 0;
    }

    canBid(creep, opts){
        return !this.catalog.isFull(creep);
    }

    calculateAllocation(creep, opts){
        return creep.carryCapacity;
    }

    calculateBid(creep, opts, job, allocation, distance){
        if(opts.resource && job.resource != opts.resource){
            return false;
        }
        if(!opts.minerals && job.resource != RESOURCE_ENERGY){
            return false;
        }
        var availableRatio = this.calcAvailRatio(job, allocation);
        return 1 + this.getStorageOffset(creep) + availableRatio;
    }

    processStep(creep, job, target, opts){
        var result;
        if(target.resourceType){
            result = creep.pickup(target);
        }else{
            result = creep.withdraw(target, job.resource);
        }
        if(result == ERR_NOT_IN_RANGE){
            creep.moveTo(target);
        }
    }

}

module.exports = PickupWorker;