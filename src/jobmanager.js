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
        _.forEach(Game.creeps, creep => {
            var id = creep.memory.jobId;
            var type = creep.memory.jobType;
            if(id && type){
                _.set(this.jobs[type], [id, 'allocated'], _.get(this.jobs[type], [id, 'allocated'], 0) + creep.memory.jobAllocation);
            }
        });
    }

    getOpenJobs(type){
        return _.pick(this.jobs[type], job => job.allocated < job.capacity);
    }
}

module.exports = JobManager;