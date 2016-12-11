"use strict";

var BaseWorker = require('./base');

class UpgradeWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'upgrade', { requiresEnergy: true, chatty: true, idleTimer: 50 }); }

    calculateAllocation(creep, opts){
        return creep.getActiveBodyparts(WORK);
    }

    calculateBid(creep, opts, job, allocation, distance){
        return this.getEnergyOffset(creep) + distance / this.distanceWeight;
    }

    processStep(creep, job, target, opts){
        if(creep.upgradeController(target) == ERR_NOT_IN_RANGE){
            creep.moveTo(target);
        }
    }

}

module.exports = UpgradeWorker;