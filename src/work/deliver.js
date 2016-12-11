"use strict";

var BaseWorker = require('./base');

var defaultTypes = [
    STRUCTURE_SPAWN,
    STRUCTURE_EXTENSION,
    STRUCTURE_TOWER
];

class DeliverWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'deliver', { requiresEnergy: true }); }

    isValid(creep, opts, job, target){
        return super.isValid(creep, opts, job, target) && this.catalog.getAvailableCapacity(target) > 10;
    }

    calculateAllocation(creep, opts){
        return this.catalog.getResource(creep, RESOURCE_ENERGY);
    }

    calculateBid(creep, opts, job, allocation, distance){
        if(opts.ignoreCreeps && job.creep){
            return false;
        }
        if(job.target.structureType && !_.includes(opts.types || defaultTypes, job.target.structureType)){
            return false;
        }
        return this.getEnergyOffset(creep) + distance / this.distanceWeight + this.catalog.getResourcePercent(job.target, RESOURCE_ENERGY)/10 + job.offset;
    }

    processStep(creep, job, target, opts){
        if(creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE){
            creep.moveTo(target);
        }
    }

}

module.exports = DeliverWorker;