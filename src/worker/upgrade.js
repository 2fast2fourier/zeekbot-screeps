"use strict";

const BaseWorker = require('./base');

class UpgradeWorker extends BaseWorker {
    constructor(){ super('upgrade', { requiresEnergy: true, quota: true, range: 3 }); }

    /// Job ///
    calculateCapacity(cluster, subtype, id, target, args){
        if(cluster.totalEnergy < 2000 && target.ticksToDowngrade > 5000){
            return 5;
        }
        if(target.level >= 8){
            return 15;
        }
        if(cluster.maxRCL <= 2){
            return 5;
        }
        if(cluster.maxRCL < 4){
            return 15;
        }
        if(target.level < 4){
            return 30;
        }
        if(Memory.levelroom != target.pos.roomName || Memory.siegemode){
            return 15;
        }
        let energy = _.get(target, 'room.storage.store.energy', 0);
        return Math.max(1, Math.floor(energy / 100000)) * 15;
    }

    upgrade(cluster, subtype){
        let controllers = _.map(cluster.getRoomsByRole('core'), 'controller');
        return this.jobsForTargets(cluster, subtype, _.filter(controllers, target => !Memory.siegemode || target.level < 8 || target.ticksToDowngrade < 145000));
    }

    /// Creep ///

    allocate(cluster, creep, opts){
        return creep.getActiveBodyparts('work');
    }

    calculateBid(cluster, creep, opts, job, distance){
        return distance / 50 + (1 - creep.carry.energy / creep.carryCapacity);
    }

    process(cluster, creep, opts, job, target){
        // var result = 
        this.orMove(creep, target, creep.upgradeController(target));
        // if(result == OK){
        //     cluster.longtermAdd('upgrade', creep.memory.jobAllocation);
        // }
    }

}

module.exports = UpgradeWorker;