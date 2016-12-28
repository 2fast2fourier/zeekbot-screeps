"use strict";

var BaseWorker = require('./base');

class PickupWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'pickup'); }

    isValid(creep, opts, job, target){
        return !this.catalog.isFull(creep) && this.catalog.getResource(target, job.resource) > 0;
    }

    canBid(creep, opts){
        return !this.catalog.isFull(creep) && creep.ticksToLive > 30;
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
        if(opts.types && !job.dropped && !_.includes(opts.types, job.target.structureType)){
            return false;
        }
        if(opts.min > 0 && this.catalog.getResource(job.target, job.resource) < opts.min){
            return false;
        }
        return 1 + this.getStorageOffset(creep) + distance / this.distanceWeight + this.calcAvailRatio(job, allocation);
    }

    processStep(creep, job, target, opts){
        var result;
        if(target.resourceType){
            result = creep.pickup(target);
        }else{
            result = creep.withdraw(target, job.resource);
        }
        if(result == ERR_NOT_IN_RANGE){
            this.move(creep, target);
        }else if(result == OK){
            creep.memory.lastSource = target.id;
        }
    }

}

module.exports = PickupWorker;