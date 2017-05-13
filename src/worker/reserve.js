"use strict";

const BaseWorker = require('./base');

class ReserveWorker extends BaseWorker {
    constructor(){ super('reserve', { quota: true }); }

    /// Job ///

    reserve(cluster, subtype){
        var controllers = _.map(_.filter(cluster.roomflags.reserve, room => _.get(room, 'controller.reservation.ticksToEnd', 0) < 3000 && room.controller), 'controller');
        return this.jobsForTargets(cluster, subtype, controllers);
    }

    calculateCapacity(cluster, subtype, id, target, args){
        return 2;
    }

    /// Creep ///

    continueJob(cluster, creep, opts, job){
        if(job.target && job.target.my){
            delete job.target.room.memory.reserve;
            return false;
        }
        return super.continueJob(cluster, creep, opts, job) && _.get(job, 'target.reservation.ticksToEnd', 0) < 4800;
    }

    keepDeadJob(cluster, creep, opts, job){
        return job.subtype == 'reserve' && job.target && !job.target.my;
    }

    allocate(cluster, creep, opts){
        return creep.getActiveBodyparts('claim');
    }

    calculateBid(cluster, creep, opts, job, distance){
        if(job.target && job.target.my){
            delete job.target.room.memory.reserve;
            return false;
        }
        return _.get(job, 'target.reservation.ticksToEnd', 0) / 5000;
    }

    process(cluster, creep, opts, job, target){
        if(Game.interval(5) && target.room.memory.claim && creep.pos.getRangeTo(target) <= 1){
            let result = creep.claimController(target);
            if(result == OK){
                console.log('Claimed room', target.pos.roomName, 'for cluster', cluster.id);
                cluster.changeRole(target.pos.roomName, 'core');
                delete Memory.rooms[target.pos.roomName].observe;
                delete Memory.rooms[target.pos.roomName].claim;
                delete Memory.rooms[target.pos.roomName].reserve;
            }else{
                console.log('Could not claim room', target.pos.roomName, 'for cluster', cluster.id, '! result:', result);
            }
        }
        this.orMove(creep, target, creep.reserveController(target));
    }

}

module.exports = ReserveWorker;