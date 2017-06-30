"use strict";

const BaseWorker = require('./base');

class RepairWorker extends BaseWorker {
    constructor(){ super('repair', { requiresEnergy: true, quota: ['repair', 'heavy', 'bunker'], range: 3, ignoreDistance: true, minEnergy: 750, minCPU: 2500 }); }

    /// Job ///

    repair(cluster, subtype){
        return this.jobsForTargets(cluster, subtype, cluster.damaged.moderate);
    }

    heavy(cluster, subtype){
        return this.jobsForTargets(cluster, subtype, cluster.damaged.heavy);
    }

    bunker(cluster, subtype){
        if(cluster.repair){
            return _.reduce(cluster.repair, (jobs, repairTarget, repairId) => {
                var target = Game.getObjectById(repairId);
                if(target && target.hits < repairTarget){
                    jobs.push(this.createJob(cluster, subtype, target));
                }
                return jobs;
            }, []);
        }else{
            return [];
        }
    }

    jobValid(cluster, job){
        if(job.subtype == 'bunker' && job.target){
            var targetHits = _.get(cluster.repair, job.target.id, cluster.opts.repair);
            return super.jobValid(cluster, job) && job.target.hits < targetHits;
        }
        return super.jobValid(cluster, job) && job.target.getDamage() > 0;
    }

    /// Creep ///

    // allocate(cluster, creep, opts){
    //     return creep.getResource(RESOURCE_ENERGY) * 100;
    // }

    calculateBid(cluster, creep, opts, job, distance){
        return job.target.hits / (job.target.getMaxHits() * 4) + (1 - creep.carry.energy / creep.carryCapacity);
    }

    process(cluster, creep, opts, job, target){
        return this.orMove(creep, target, creep.repair(target)) == OK;
    }

}

module.exports = RepairWorker;