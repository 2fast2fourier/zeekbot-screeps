"use strict";

class BaseAction {
    constructor(catalog, type){
        this.catalog = catalog;
        this.type = type;
    }

    preWork(creep, opts){}

    shouldBlock(creep, opts){
        return false;
    }

    postWork(creep, opts, action){}

    blocked(creep, opts, block){}

    hasJob(creep){
        return creep.memory.jobId && creep.memory.jobType;
    }

    getJobTarget(creep){
        var job = this.catalog.jobs.getJob(creep.memory.jobType, creep.memory.jobId);
        if(job && job.target){
            return job.target;
        }
        if(creep.memory.jobId){
            return Game.getObjectById(creep.memory.jobId);
        }
        return false;
    }

}

module.exports = BaseAction;