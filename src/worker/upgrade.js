"use strict";

const BaseWorker = require('./base');

class UpgradeWorker extends BaseWorker {
    constructor(){ super('upgrade', { requiresEnergy: true, quota: ['upgrade'], range: 3 }); }

    /// Job ///
    calculateCapacity(cluster, subtype, id, target, args){
        if(subtype == 'levelroom'){
            return 999;
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
        return 15;
    }

    upgrade(cluster, subtype){
        let controllers = _.map(cluster.getRoomsByRole('core'), 'controller');
        return this.jobsForTargets(cluster, subtype, _.filter(controllers, target => target.my && Memory.state.levelroom != target.room.name));
    }

    levelroom(cluster, subtype){
        let controllers = _.map(cluster.getRoomsByRole('core'), 'controller');
        return this.jobsForTargets(cluster, subtype, _.filter(controllers, target => target.my && target.level < 8 && Memory.state.levelroom == target.room.name));
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

    generateAssignments(cluster, assignments, quota, tickets){
        let room = Memory.state.levelroom ? Game.rooms[Memory.state.levelroom] : false;
        if(room && room.memory.cluster == cluster.id && room.controller.my){
            let divisor = Memory.state.energy > 0.6 ? 100000 : 125000;
            let energy = _.get(room, 'storage.store.energy', 0);
            let count = Math.max(1, Math.floor(energy / divisor));
            tickets.push({
                id: Memory.state.levelroom,
                tag: 'levelroom',
                type: 'level-upgradeworker',
                boosts: { upgradeController: 15 },
                capacity: count
            });
        }
    }

}

module.exports = UpgradeWorker;