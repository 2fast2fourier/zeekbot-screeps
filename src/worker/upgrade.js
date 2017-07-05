"use strict";

const BaseWorker = require('./base');

class UpgradeWorker extends BaseWorker {
    constructor(){ super('upgrade', { requiresEnergy: true, quota: ['upgrade', 'levelroom'], range: 3 }); }

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
        if(Memory.levelroom == target.pos.roomName){
            let energy = _.get(target, 'room.storage.store.energy', 0);
            return Math.max(1, Math.floor(energy / 150000)) * 15;
        }
        return 15;
    }

    upgrade(cluster, subtype){
        let controllers = _.map(cluster.getRoomsByRole('core'), 'controller');
        return this.jobsForTargets(cluster, subtype, _.filter(controllers, target => Memory.state.levelroom != target.room.name &&
                (!Memory.siegemode || target.level < 8 || target.ticksToDowngrade < 145000 || cluster.totalEnergy > 400000 * cluster.structures.storage.length)));
    }

    levelroom(cluster, subtype){
        if(Memory.state.levelroom){
            var room = Game.rooms[Memory.state.levelroom];
            if(room && room.memory.cluster == cluster.id){
                return [this.createJob(cluster, subtype, room.controller)];
            }
        }
        return [];
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