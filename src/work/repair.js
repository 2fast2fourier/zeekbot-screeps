"use strict";

var StaticWorker = require('./static');

class RepairWorker extends StaticWorker {
    constructor(catalog){ super(catalog, 'repair', { requiresEnergy: true, chatty: true }); }

    isValid(creep, opts, target){
        return target.hits < Math.min(target.hitsMax, Memory.settings.repairTarget);
    }

    canBid(creep, opts, target){
        return target.hits < Math.min(target.hitsMax, Memory.settings.repairTarget);
    }

    processStep(creep, target, opts){
        return this.orMove(creep, target, creep.repair(target)) == OK;
    }

}

module.exports = RepairWorker;