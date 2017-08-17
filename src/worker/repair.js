"use strict";

const BaseWorker = require('./base');
const Pathing = require('../pathing');

class RepairWorker extends BaseWorker {
    constructor(){ super('repair', { requiresEnergy: true, quota: ['repair', 'heavy'], range: 3, ignoreDistance: true, minEnergy: 750, minCPU: 2500 }); }

    /// Job ///

    repair(cluster, subtype){
        return this.jobsForTargets(cluster, subtype, cluster.damaged.moderate);
    }

    heavy(cluster, subtype){
        return this.jobsForTargets(cluster, subtype, cluster.damaged.heavy);
    }

    special(cluster, subtype){
        let jobs = [];
        if(cluster.state.repair){
            _.reduce(cluster.state.repair, (result, repairTarget, repairId) => {
                var target = Game.getObjectById(repairId);
                if(target && target.hits < repairTarget){
                    result.push(this.createJob(cluster, subtype, target));
                }
                return result;
            }, jobs);
        }
        return jobs;
    }

    defenses(cluster, subtype){
        return this.jobsForTargets(cluster, subtype, cluster.structures.rampart);
    }

    jobValid(cluster, job){
        if(job.subtype == 'defenses'){
            return super.jobValid(cluster, job) && job.target.hits < job.target.hitsMax;
        }
        if(job.subtype == 'special' && job.target){
            var targetHits = _.get(cluster.state.repair, job.target.id, cluster.opts.repair);
            return super.jobValid(cluster, job) && job.target.hits < targetHits + 100000;
        }
        return super.jobValid(cluster, job) && job.target.getDamage() > 0;
    }

    calculateQuota(cluster, quota){
        quota['repair-repair'] = 3 + (Math.ceil(cluster.work.repair.damage.moderate / 100000) * 3);
        quota['heavy-repair'] = Math.min(_.size(cluster.work.repair.heavy), Math.ceil(cluster.work.repair.damage.heavy / 250000) * 3);
    }

    /// Creep ///

    calculateBid(cluster, creep, opts, job, distance){
        if(job.subtype == 'defenses'){
            return job.target.hits / job.target.hitsMax + (1 - creep.carry.energy / creep.carryCapacity);
        }
        return job.target.hits / (job.target.getMaxHits() * 4) + (1 - creep.carry.energy / creep.carryCapacity);
    }

    process(cluster, creep, opts, job, target){
        let distance = creep.pos.getRangeTo(target);
        if(distance <= this.range && distance > 1 && (target.pos.x <= 2 || target.pos.y <= 2 || target.pos.x >= 47 || target.pos.y >= 47)){
            Pathing.moveCreep(creep, target, 1, false);
        }
        return this.orMove(creep, target, creep.repair(target)) == OK;
    }

    // ticket: {
    //     id,
    //     tag,
    //     boost: opts.boost || 'any',
    //     capacity: opts.capacity || 1,
    //     memory: opts.memory
    // }
    generateAssignments(cluster, assignments, quota, tickets){
        if(cluster.state.repair){
            tickets.push({
                id: cluster.id,
                tag: 'bunker-repair',
                type: 'special-repairworker',
                capacity: Math.min(4, Math.ceil(_.size(cluster.state.repair) / 3))
            });
        }
    }

}

module.exports = RepairWorker;