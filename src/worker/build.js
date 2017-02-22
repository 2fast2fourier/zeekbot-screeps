"use strict";

const BaseWorker = require('./base');

class BuildWorker extends BaseWorker {
    constructor(){ super('build', { requiresEnergy: true, quota: true, range: 3, minEnergy: 500 }); }

    /// Job ///
    calculateCapacity(cluster, subtype, id, target, args){
        return  target.progressTotal - target.progress;
    }

    build(cluster, subtype){
        return this.jobsForTargets(cluster, subtype, cluster.findAll(FIND_MY_CONSTRUCTION_SITES));
    }

    /// Creep ///

    calculateBid(cluster, creep, opts, job, distance){
        return distance / 50 + (1 - job.target.progress / job.target.progressTotal);
    }

    allocate(cluster, creep, opts){
        return creep.getResource(RESOURCE_ENERGY);
    }

    process(cluster, creep, opts, job, target){
        this.orMove(creep, target, creep.build(target));
    }

}

module.exports = BuildWorker;