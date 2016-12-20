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
        this.orMove(creep, target, creep.upgradeController(target));
    }

}

module.exports = UpgradeWorker;