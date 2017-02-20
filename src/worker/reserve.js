"use strict";

const BaseWorker = require('./base');

class ReserveWorker extends BaseWorker {
    constructor(){ super('reserve', { quota: true }); }

    /// Job ///

    shouldReserve(room){
        return room.controller && _.get(room, 'controller.reservation.ticksToEnd', 0) < 4000 && !room.controller.my && room.memory.role != 'core';
    }

    reserve(cluster, subtype){
        return this.jobsForTargets(cluster, subtype, _.map(_.filter(cluster.rooms, room => this.shouldReserve(room)), 'controller'));
    }

    calculateCapacity(cluster, subtype, id, target, args){
        return 2;
    }

    jobValid(cluster, job){
        return job.id && job.target;
    }

    /// Creep ///

    continueJob(cluster, creep, opts, job){
        return super.continueJob(cluster, creep, opts, job) && _.get(job, 'target.reservation.ticksToEnd', 0) < 4800;
    }

    keepDeadJob(cluster, creep, opts, job){
        return job.subtype == 'reserve';
    }

    allocate(cluster, creep, opts){
        return creep.getActiveBodyparts('claim');
    }

    calculateBid(cluster, creep, opts, job, distance){
        return _.get(job, 'target.reservation.ticksToEnd', 0) / 5000;
    }

    process(cluster, creep, opts, job, target){
        if(Game.interval(25)){
            let flag = Game.flags['Claim'];
            if(flag && creep.pos.getRangeTo(target) <= 1 && flag.pos.roomName == target.pos.roomName){
                let result = creep.claimController(target);
                if(result == OK){
                    console.log('Claimed room', target.pos.roomName, 'for cluster', cluster.id);
                    cluster.changeRole(target.pos.roomName, 'core');
                }else{
                    console.log('Could not claim room', target.pos.roomName, 'for cluster', cluster.id, '! result:', result);
                }
                flag.remove();
            }
        }
        this.orMove(creep, target, creep.reserveController(target));
    }

}

module.exports = ReserveWorker;