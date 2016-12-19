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
        var energy = this.getEnergyOffset(creep);
        if(energy < 0.75){
            return distance / 100 + this.calcRepairOffset(job.target);
        }
        return energy + distance / 100 + this.calcRepairOffset(job.target);
    }

    calcRepairOffset(target){
        var percent = target.hits / Math.min(target.hitsMax, Memory.settings.repairTarget);
        if(percent < 0.5){
            return -1 + percent;
        }
        return 0;
    }

    processStep(creep, job, target, opts){
        if(creep.repair(target) == ERR_NOT_IN_RANGE){
            creep.moveTo(target);
        }
    }

}

module.exports = RepairWorker;