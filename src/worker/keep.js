"use strict";

const BaseWorker = require('./base');

class KeepWorker extends BaseWorker {
    constructor(){ super('keep', { ignoreRoads: true }); }

    /// Job ///

    keep(cluster, subtype){
        if(cluster.maxRCL < 8){
            return [];
        }
        let keeps = cluster.findIn(cluster.roomflags.keep, FIND_HOSTILE_STRUCTURES);
        return this.jobsForTargets(cluster, subtype, _.reject(keeps, keep => keep.ticksToSpawn > 50));
    }

    jobValid(cluster, job){
        return super.jobValid(cluster, job) && !(job.target.ticksToSpawn > 50 && job.target.ticksToSpawn < 270);
    }

    /// Creep ///

    keepDeadJob(cluster, creep, opts, job){
        return _.some(creep.room.matrix.creeps.keeper, target => creep.pos.getRangeTo(target) < 7);
    }

    canBid(cluster, creep, opts){
        return creep.hits > creep.hitsMax * 0.5 && creep.ticksToLive > 50;
    }

    calculateBid(cluster, creep, opts, job, distance){
        if(job.target.ticksToSpawn > creep.ticksToLive - 20){
            return false;
        }
        return (job.target.ticksToSpawn || 0) / 300 + distance / 100;
    }

    process(cluster, creep, opts, job, target){
        let nearest = _.min(creep.room.matrix.creeps.keeper, keeper => creep.pos.getRangeTo(keeper));
        let range = creep.pos.getRangeTo(nearest);
        if(range <= 10){
            let targetRange = creep.hits > creep.hitsMax * 0.6 ? 3 : 5;
            if(range < targetRange){
                this.moveAway(creep, nearest, targetRange);
            }else if(range > targetRange){
                this.move(creep, nearest);
            }
            if(range <= 3){
                creep.rangedAttack(nearest);
            }
        }else if(creep.pos.getRangeTo(target) < 3){
            this.moveAway(creep, target, 3);
        }else if(creep.pos.getRangeTo(target) > 3){
            this.move(creep, target);
        }
        if(creep.hits < creep.hitsMax){
            creep.heal(creep);
        }
    }

    generateAssignments(cluster, assignments, quota, tickets){
        assignments.keep = _.zipObject(_.map(cluster.roles.keep, 'name'), new Array(cluster.roles.keep.length).fill(1));
        quota.keep = _.sum(assignments.keep);
    }

}

module.exports = KeepWorker;