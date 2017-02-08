"use strict";

var Jobs = require('./jobs');

class JobManager {
    constructor(catalog){
        this.catalog = catalog;
        this.jobs = {};
        this.subjobs = {};
        this.openJobs = {};
        this.openSubJobs = {};
        this.capacity = {};
        this.allocation = {};
        this.staticAllocation = {};
        this.categories = Jobs(catalog);
        this.dirty = [];
    }

    generate(){
        _.forEach(this.categories, (category, categoryName) =>{
            var cap = 0;
            var type = category.getType();
            var jobList = category.generate();
            this.jobs[type] = jobList;
            _.forEach(jobList, (job, id)=>{
                cap += job.capacity;
                if(job.subtype){
                    var fullType = type+'-'+job.subtype;
                    _.set(this.subjobs, [fullType, id], job);
                    this.capacity[fullType] = job.capacity + _.get(this.capacity, fullType, 0);
                }else{
                    _.set(this.subjobs, [type, id], job);
                }
            });
            if(category.static){
                cap = _.size(Memory.jobs[type]);
            }
            this.capacity[type] = cap;
            this.allocation[type] = 0;
        });
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

    getOpenSubJobs(type, subtype){
        var fullType = subtype === false ? type : type+'-'+subtype;
        if(!this.openSubJobs[fullType]){
            this.openSubJobs[fullType] = _.pick(this.subjobs[fullType], job => job.allocated < job.capacity);
        }
        return this.openSubJobs[fullType];
    }

    getJob(type, id){
        return _.get(this.jobs, [type, id], false);
    }

    addAllocation(type, jobId, allocation){
        if(jobId && type){
            var full = this.categories[type].addAllocation(this.jobs[type], jobId, allocation);
            this.allocation[type] += allocation;
            if(full && _.has(this.openJobs, [type, jobId])){
                delete this.openJobs[type][jobId];
            }
        }
    }

    removeAllocation(type, jobId, allocation){
        if(jobId && type && _.has(this.jobs, [type, jobId])){
            var dirty = this.categories[type].removeAllocation(this.jobs[type], jobId, allocation);
            this.allocation[type] -= allocation;
            if(dirty){
                this.dirty.push(type);
            }
        }
    }

    postValidate(){
        _.forEach(this.dirty, (type) =>{
            this.openJobs[type] = _.pick(this.jobs[type], job => job.allocated < job.capacity);
        });
    }
}

module.exports = JobManager;