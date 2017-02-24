"use strict";

const BaseWorker = require('./base');

class ReserveWorker extends BaseWorker {
    constructor(){ super('reserve', { quota: true }); }

    /// Job ///

    shouldReserve(room){
        return _.get(room, 'controller.reservation.ticksToEnd', 0) < 4000 && !room.controller.my;
    }

    reserve(cluster, subtype){
        return this.jobsForTargets(cluster, subtype, _.map(_.filter(cluster.roomBehavior.reserve, room => this.shouldReserve(room)), 'controller'));
    }

    calculateCapacity(cluster, subtype, id, target, args){
        return 2;
    }

    /// Creep ///

    continueJob(cluster, creep, opts, job){
        return super.continueJob(cluster, creep, opts, job) && _.get(job, 'target.reservation.ticksToEnd', 0) < 4800 && !job.target.my;
    }

    keepDeadJob(cluster, creep, opts, job){
        return job.subtype == 'reserve' && job.target && !job.target.my;
    }

    allocate(cluster, creep, opts){
        return creep.getActiveBodyparts('claim');
    }

    calculateBid(cluster, creep, opts, job, distance){
        return _.get(job, 'target.reservation.ticksToEnd', 0) / 5000;
    }

    process(cluster, creep, opts, job, target){
        if(Game.interval(5) && target.room.memory.claim && creep.pos.getRangeTo(target) <= 1){
            let result = creep.claimController(target);
            if(result == OK){
                console.log('Claimed room', target.pos.roomName, 'for cluster', cluster.id);
                cluster.changeRole(target.pos.roomName, 'core');
            }else{
                console.log('Could not claim room', target.pos.roomName, 'for cluster', cluster.id, '! result:', result);
            }
        }
        this.orMove(creep, target, creep.reserveController(target));
    }

}

module.exports = ReserveWorker;