"use strict";

const BaseWorker = require('./base');

class UpgradeWorker extends BaseWorker {
    constructor(){ super('upgrade', { requiresEnergy: true, quota: true, range: 3 }); }

    /// Job ///
    calculateCapacity(cluster, subtype, id, target, args){
        if(cluster.totalEnergy < 2000 && target.ticksToDowngrade > 5000){
            return 5;
        }
        if(cluster.maxRCL <= 2){
            return 5;
        }
        if(target.level < 4 && target.room.memory.powerlevel){
            return 20;
        }
        if(cluster.maxRCL < 4){
            return 10;
        }
        if(target.level == 8){
            return 15;
        }
        if(target.level < 5 && target.room.memory.powerlevel){
            return 30;
        }
        let energy = _.get(target, 'room.storage.store.energy', 0);
        if(target.level < 7 && energy > 100000 && target.room.memory.powerlevel){
            return Math.max(2, Math.floor(energy / 100000)) * 15;
        }
        return Math.max(1, Math.floor(energy / 150000)) * 15;
    }

    upgrade(cluster, subtype){
        let controllers = _.map(cluster.getRoomsByRole('core'), 'controller');
        return this.jobsForTargets(cluster, subtype, _.filter(controllers, controller => controller.level < 8 || cluster.totalEnergy > 5000 || controller.ticksToDowngrade < 10000));
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