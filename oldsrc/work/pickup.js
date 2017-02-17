"use strict";

var BaseWorker = require('./base');

var offset = {
    link: 0,
    container: 0.05
}

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
        var distanceWeight = opts.distanceWeight || this.distanceWeight;
        if(!opts.minerals && job.resource != RESOURCE_ENERGY){
            return false;
        }
        if(opts.types && !job.dropped && !_.includes(opts.types, job.target.structureType)){
            return false;
        }
        var offset = _.get(offset, job.target.structureType, 0);
        if(job.resource != RESOURCE_ENERGY && job.dropped){
            offset = -1;
        }
        return 1 + this.getStorageOffset(creep) + distance / distanceWeight + this.calcAvailRatio(job, allocation) + offset;
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
            this.catalog.profileAdd('actions', 0.2);
        }
    }

}

module.exports = PickupWorker;