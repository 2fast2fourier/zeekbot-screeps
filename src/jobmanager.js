"use strict";

var Jobs = require('./jobs');

class JobManager {
    constructor(catalog){
        this.catalog = catalog;
        this.jobs = {};
        this.capacity = {};
        this.allocation = {};
        this.categories = Jobs(catalog);
    }

    generate(){
        _.forEach(this.categories, category =>{
            var cap = 0;
            this.jobs[category.getType()] = category.generate();
            _.forEach(this.jobs[category.getType()], job => cap += job.capacity);
            this.capacity[category.getType()] = cap;
            this.allocation[category.getType()] = 0;
        });
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
            this.allocation[type] += allocation;
        }
    }
}

module.exports = JobManager;