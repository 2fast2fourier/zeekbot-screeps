"use strict";

const BaseWorker = require('./base');

class UpgradeWorker extends BaseWorker {
    constructor(){ super('upgrade', { requiresEnergy: true, quota: true, range: 3 }); }

    /// Job ///
    calculateCapacity(cluster, subtype, id, target, args){
        if(cluster.maxRCL == 1){
            return 5;
        }
        if(target.level == 8){
            return 15;
        }
        // if(cluster.maxRCL > 4 && target.level < 4){
        //     return 15;
        // }
        if(cluster.totalEnergy < 2000){
            return 5;
        }
        if(target.level >= 6){
            return 20;
        }
        return 10;
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