"use strict";

const BaseWorker = require('./base');

class IdleWorker extends BaseWorker {
    constructor(){ super('idle', { priority: 99, critical: true }); }

    /// Job ///
    calculateCapacity(cluster, subtype, id, target, args){
        return 8;
    }

    generateJobsForSubtype(cluster, subtype){
        return this.jobsForTargets(cluster, subtype, cluster.structures[subtype]);
    }

    /// Creep ///

    continueJob(cluster, creep, opts, job){
        return super.continueJob(cluster, creep, opts, job) && !Game.interval(10);
    }

    calculateBid(cluster, creep, opts, job, distance){
        return distance / 50;
    }

    process(cluster, creep, opts, job, target){
        if(creep.pos.getRangeTo(target) > 2){
            this.move(creep, target);
        }
    }

}

module.exports = IdleWorker;