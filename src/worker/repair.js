"use strict";

const BaseWorker = require('./base');

class RepairWorker extends BaseWorker {
    constructor(){ super('repair', { requiresEnergy: true, quota: true }); }

    /// Job ///
    calculateCapacity(cluster, subtype, id, target, args){
        return target.getDamage();
    }

    repair(cluster, subtype){
        let targets = _.filter(cluster.findAll(FIND_STRUCTURES), struct => struct.hits < struct.getMaxHits());
        return this.jobsForTargets(cluster, subtype, targets);
    }

    jobValid(cluster, job){
        return super.jobValid(cluster, job) && job.target.getDamage() > 0;
    }

    /// Creep ///

    allocate(cluster, creep, opts){
        return creep.getResource(RESOURCE_ENERGY) * 100;
    }

    calculateBid(cluster, creep, opts, job, distance){
        return job.target.hits / (job.target.getMaxHits() * 4) + (1 - creep.carry.energy / creep.carryCapacity);
    }

    process(cluster, creep, opts, job, target){
        return this.orMove(creep, target, creep.repair(target)) == OK;
    }

}

module.exports = RepairWorker;