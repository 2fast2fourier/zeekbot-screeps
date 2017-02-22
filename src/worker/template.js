"use strict";

const BaseWorker = require('./base');

class TempWorker extends BaseWorker {
    constructor(){ super('template', { requiresEnergy: true, quota: true, range: 1 }); }

    /// Job ///
    // calculateCapacity(cluster, subtype, id, target, args){
    //     return 1;
    // }

    subtype(cluster, subtype){
        let targets = _.filter(cluster.findAll(FIND_STRUCTURES), struct => struct.hits < struct.getMaxHits());
        return this.jobsForTargets(cluster, subtype, targets);
    }

    // jobValid(cluster, job){
    //     return super.jobValid(cluster, job);
    // }

    /// Creep ///

    // allocate(cluster, creep, opts){
    //     return creep.getActiveBodyparts('work');
    // }

    // continueJob(cluster, creep, opts, job){
    //     return super.continueJob(cluster, creep, opts, job);
    // }

    // keepDeadJob(cluster, creep, opts, job){
    //     return false;
    // }

    // canBid(cluster, creep, opts){
    //     return super.canBid(cluster, creep, opts);
    // }

    calculateBid(cluster, creep, opts, job, distance){
        return distance / 50;
    }

    // start(cluster, creep, opts, job){}

    process(cluster, creep, opts, job, target){
        // this.orMove(creep, target, creep.repair(target));
    }
    
    // end(cluster, creep, opts, job){}

}

module.exports = TempWorker;