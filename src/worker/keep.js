"use strict";

const BaseWorker = require('./base');

class KeepWorker extends BaseWorker {
    constructor(){ super('keep', { ignoreRoads: true }); }

    /// Job ///

    keep(cluster, subtype){
        if(cluster.maxRCL < 7){
            return [];
        }
        let keeps = cluster.findIn(cluster.roomflags.keep, FIND_HOSTILE_STRUCTURES);
        return this.jobsForTargets(cluster, subtype, _.reject(keeps, keep => keep.ticksToSpawn > 60));
    }

    jobValid(cluster, job){
        return super.jobValid(cluster, job) && !(job.target.ticksToSpawn > 60 && job.target.ticksToSpawn < 280);
    }

    /// Creep ///

    continueJob(cluster, creep, opts, job){
        return super.continueJob(cluster, creep, opts, job);
    }

    canBid(cluster, creep, opts){
        return creep.hits > creep.hitsMax * 0.8 && creep.ticksToLive > 25;
    }

    calculateBid(cluster, creep, opts, job, distance){
        if(job.target.ticksToSpawn > creep.ticksToLive){
            return false;
        }
        return (job.target.ticksToSpawn || 0) / 300 + distance / 500;
    }

    process(cluster, creep, opts, job, target){
        let idleRange = target.ticksToSpawn < 10 ? 1 : 2;
        let hostiles = creep.room.find(FIND_HOSTILE_CREEPS, { filter: target => creep.pos.getRangeTo(target) < 10 || _.get(target, 'owner.username', false) != 'Source Keeper' });
        if(hostiles.length > 0){
            var enemy = _.first(_.sortBy(hostiles, hostile => creep.pos.getRangeTo(hostile)));
            if(creep.getActiveBodyparts(RANGED_ATTACK) > 0 && creep.pos.getRangeTo(enemy) <= 3){
                creep.rangedAttack(enemy);
            }
            return this.orMove(creep, enemy, creep.attack(enemy)) == OK;
        }else if(creep.pos.getRangeTo(target) > idleRange){
            this.move(creep, target);
        }else if(creep.pos.getRangeTo(target) < idleRange){
            this.moveAway(creep, target, idleRange);
        }
    }

}

module.exports = KeepWorker;