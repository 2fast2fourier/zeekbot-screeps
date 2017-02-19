"use strict";

const BaseWorker = require('./base');

class UpgradeWorker extends BaseWorker {
    constructor(){ super('upgrade', { requiresEnergy: true, quota: true }); }

    /// Job ///
    calculateCapacity(cluster, subtype, id, target, args){
        return 5;
    }

    upgrade(cluster, subtype){
        return this.jobsForTargets(cluster, subtype, _.map(cluster.roleRooms.core, 'controller'));
    }

    /// Creep ///

    calculateBid(cluster, creep, opts, job, allocation, distance){
        return distance / 50;
    }

    process(cluster, creep, opts, job, target){
        this.orMove(creep, target, creep.upgradeController(target));
    }

}

module.exports = UpgradeWorker;