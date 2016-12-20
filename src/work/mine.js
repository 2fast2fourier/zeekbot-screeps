"use strict";

var BaseWorker = require('./base');

class MineWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'mine'); }

    isValid(creep, opts, job, target){
        return this.catalog.getAvailableCapacity(creep) > 8;
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
        if(this.catalog.getAvailableCapacity(creep) < 20){
            var deliverables = _.filter(this.catalog.jobs.getOpenJobs('deliver'), job => !job.creep && creep.pos.getRangeTo(job.target) <= 1 && this.catalog.getAvailableCapacity(job.target) > 0);
            var nearby = _.sortBy(deliverables, job => this.catalog.getAvailableCapacity(job.target));
            if(nearby.length > 0){
                _.forEach(creep.carry, (amount, type)=>{
                    if(amount > 0){
                        creep.transfer(nearby[0].target, type);
                    }
                });
            }
        }
        this.orMove(creep, target, creep.harvest(target));
        if(creep.ticksToLive == 100){
            creep.memory.jobAllocation = Math.ceil(creep.memory.jobAllocation / 2);
        }
    }

}

module.exports = MineWorker;