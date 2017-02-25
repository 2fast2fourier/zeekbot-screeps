"use strict";

class BaseAction {
    constructor(type){
        this.type = type;
    }

    preWork(cluster, creep, opts){}

    shouldBlock(cluster, creep, opts){
        return false;
    }

    postWork(cluster, creep, opts, action){}

    blocked(cluster, creep, opts, block){
        console.log('block not implemented!', this);
    }

    hasJob(creep){
        return creep.memory.job && creep.memory.jobType;
    }

    // getJobTarget(creep){
    //     var job = this.catalog.jobs.getJob(creep.memory.jobType, creep.memory.jobId);
    //     if(job && job.target){
    //         return job.target;
    //     }
    //     if(creep.memory.jobId){
    //         return Game.getObjectById(creep.memory.jobId);
    //     }
    //     return false;
    // }

}

module.exports = BaseAction;