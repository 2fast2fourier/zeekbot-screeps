"use strict";

var BaseWorker = require('./base');

class TransferWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'transfer', { chatty: true }); }

    isValid(creep, opts, job, target){
        var resources = this.catalog.getResource(creep, job.resource);
        if(resources == 0){
            return this.catalog.getResource(job.pickup, job.resource) > 0;
        }else{
            if(job.resource == RESOURCE_ENERGY && target.energyCapacity > 0){
                return (target.energyCapacity - target.energy) > 0;
            }
            return this.catalog.getAvailableCapacity(target) > 0;
        }
    }

    calculateAllocation(creep, opts){
        return this.catalog.getCapacity(creep);
    }

    calculateBid(creep, opts, job, allocation, distance){
        var holding = this.catalog.getResource(creep, job.resource);
        if(this.catalog.getStoragePercent(creep) > 0.5 && holding == 0){
            return false;
        }
        if(!job.pickup || this.catalog.getResource(job.pickup, job.resource) == 0){
            return false;
        }
        return distance / this.distanceWeight + (1 - job.amount / creep.carryCapacity);
    }

    processStep(creep, job, target, opts){
        var resources = this.catalog.getResource(creep, job.resource);
        if(resources > 0){
            creep.memory.jobAllocation = resources;
            this.orMove(creep, target, creep.transfer(target, job.resource, Math.min(resources, job.amount)));
        }else{
            var amount = Math.min(this.catalog.getAvailableCapacity(creep), Math.min(this.catalog.getResource(job.pickup, job.resource), job.amount));
            this.orMove(creep, job.pickup, creep.withdraw(job.pickup, job.resource, amount));
        }
    }

}

module.exports = TransferWorker;