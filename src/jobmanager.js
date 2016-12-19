"use strict";

var Jobs = require('./jobs');

class JobManager {
    constructor(catalog){
        this.catalog = catalog;
        this.jobs = {};
        this.openJobs = {};
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
            // console.log(category.getType(), cap);
            this.allocation[category.getType()] = 0;
        });
        if(Memory.debugJob){
            _.forEach(this.jobs[Memory.debugJob], (job, type) => console.log(type, job.target, job.capacity));
        }
    }

    allocate(){
        _.forEach(Game.creeps, creep => this.addAllocation(creep.memory.jobType, creep.memory.jobId, creep.memory.jobAllocation));
    }

    getOpenJobs(type){
        if(!this.openJobs[type]){
            this.openJobs[type] = _.pick(this.jobs[type], job => job.allocated < job.capacity);
        }
        return this.openJobs[type];
    }

    getJob(type, id){
        return _.get(this.jobs, [type, id], false);
    }

    addAllocation(type, jobId, allocation){
        if(jobId && type && _.has(this.jobs, [type, jobId])){
            _.set(this.jobs[type], [jobId, 'allocated'], _.get(this.jobs[type], [jobId, 'allocated'], 0) + allocation);
            this.allocation[type] += allocation;
            var job = _.get(this.jobs[type], jobId, false);
            if(job && job.allocated >= job.capacity && _.has(this.openJobs, [type, jobId])){
                delete this.openJobs[type][jobId];
            }
        }
    }

    removeAllocation(type, jobId, allocation){
        if(jobId && type && _.has(this.jobs, [type, jobId])){
            _.set(this.jobs[type], [jobId, 'allocated'], _.get(this.jobs[type], [jobId, 'allocated'], 0) - allocation);
            this.allocation[type] -= allocation;
            var job = _.get(this.jobs[type], jobId, false);
            if(job && job.allocated < job.capacity && !_.has(this.openJobs, [type, jobId])){
                this.openJobs[type] = _.pick(this.jobs[type], job => job.allocated < job.capacity);
            }
        }
    }
}

module.exports = JobManager;