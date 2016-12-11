"use strict";

var Jobs = require('./jobs');

class JobManager {
    constructor(catalog){
        this.catalog = catalog;
        this.jobs = {};
        this.working = {};
        this.categories = Jobs(catalog);
    }

    generate(){
        _.forEach(this.categories, category => this.jobs[category.getType()] = category.generate());
    }

    allocate(){
        _.forEach(Game.creeps, creep => this.addAllocation(creep.memory.jobType, creep.memory.jobId, creep.memory.jobAllocation));
    }

    getOpenJobs(type){
        return _.pick(this.jobs[type], job => job.allocated < job.capacity);
    }

    getJob(type, id){
        return _.get(this.jobs, [type, id], false);
    }

    addAllocation(type, jobId, allocation){
        if(jobId && type && _.has(this.jobs, [type, jobId])){
            _.set(this.jobs[type], [jobId, 'allocated'], _.get(this.jobs[type], [jobId, 'allocated'], 0) + allocation);
        }
    }
}

module.exports = JobManager;