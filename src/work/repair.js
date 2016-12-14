"use strict";

var BaseWorker = require('./base');

class RepairWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'repair', { requiresEnergy: true, chatty: true }); }

    calculateAllocation(creep, opts){
        if(creep.getActiveBodyparts(WORK) > 0){
            return this.catalog.getResource(creep, RESOURCE_ENERGY);
        }
        return 0;
    }

    calculateBid(creep, opts, job, allocation, distance){
        return this.getEnergyOffset(creep) + distance / this.distanceWeight + this.calcRepairOffset(job.target);
    }

    calcRepairOffset(target){
        return (target.hits / Math.min(target.hitsMax, Memory.settings.repairTarget))/10;
    }

    processStep(creep, job, target, opts){
        if(creep.repair(target) == ERR_NOT_IN_RANGE){
            creep.moveTo(target);
        }
    }

}

module.exports = RepairWorker;