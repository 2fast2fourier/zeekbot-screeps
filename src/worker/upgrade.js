"use strict";

const BaseWorker = require('./base');

class UpgradeWorker extends BaseWorker {
    constructor(){ super('upgrade', { requiresEnergy: true, quota: ['upgrade', 'levelroom'], range: 3 }); }

    /// Job ///
    calculateCapacity(cluster, subtype, id, target, args){
        if(subtype == 'upgrade'){
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
        if(Memory.levelroom == target.pos.roomName || target.level < 7){
            let divisor = Memory.state.energy > 0.6 ? 75000 : Memory.state.energy > 0.5 ? 100000 : 150000;
            let energy = _.get(target, 'room.storage.store.energy', 0);
            return Math.max(1, Math.floor(energy / divisor)) * 15;
        }
        return 15;
    }

    upgrade(cluster, subtype){
        let controllers = _.map(cluster.getRoomsByRole('core'), 'controller');
        return this.jobsForTargets(cluster, subtype, _.filter(controllers, target => target.my && target.level == 8));
    }

    levelroom(cluster, subtype){
        let controllers = _.map(cluster.getRoomsByRole('core'), 'controller');
        return this.jobsForTargets(cluster, subtype, _.filter(controllers, target => target.my && target.level < 8));
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