"use strict";

const BaseWorker = require('./base');

class UpgradeWorker extends BaseWorker {
    constructor(){ super('upgrade', { requiresEnergy: true, quota: true, range: 3 }); }

    /// Job ///
    calculateCapacity(cluster, subtype, id, target, args){
        if(cluster.totalEnergy < 2000){
            return 5;
        }
        if(target.level == 8){
            return 15;
        }
        if(cluster.maxRCL <= 2){
            return 5;
        }
        if(cluster.maxRCL < 4){
            return 10;
        }
        let energy = _.get(target, 'room.storage.store.energy', 0);
        return Math.max(1, Math.floor(energy / 150000)) * 15;
    }

    upgrade(cluster, subtype){
        return this.jobsForTargets(cluster, subtype, _.map(cluster.getRoomsByRole('core'), 'controller'));
    }

    /// Creep ///

    allocate(cluster, creep, opts){
        return creep.getActiveBodyparts('work');
    }

    calculateBid(cluster, creep, opts, job, distance){
        return distance / 50 + (1 - creep.carry.energy / creep.carryCapacity);
    }

    process(cluster, creep, opts, job, target){
        this.orMove(creep, target, creep.upgradeController(target));
    }

}

module.exports = UpgradeWorker;