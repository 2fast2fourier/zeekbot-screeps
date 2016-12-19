"use strict";

class BaseJob {
    constructor(catalog, type, opts){
        this.catalog = catalog;
        this.type = type;
        if(opts){
            _.assign(this, opts);
        }
    }

    getType(){
        return this.type;
    }

    generateId(entity){
        return this.type+'-'+(entity.id || entity.name);
    }

    getRooms(){
        return this.catalog.rooms;
    }

    generate(){
        var jobs = {};
        _.forEach(this.getRooms(), room => _.forEach(this.generateJobs(room), job => jobs[job.id] = job));
        if(this.flagPrefix){
            _.forEach(this.catalog.getFlagsByPrefix(this.flagPrefix), flag => _.forEach(this.generateJobsForFlag(flag), job => jobs[job.id] = job));
        }
        return this.postGenerate(jobs);
    }

    postGenerate(jobs){
        return jobs;
    }

    generateJobs(room, flag){
        return _.map(this.generateTargets(room, flag), target => this.finalizeJob(room, target, this.generateJobForTarget(room, target, flag)));
    }

    generateJobForTarget(room, target, flag){
        return {
            allocated: 0,
            capacity: this.calculateCapacity(room, target, flag),
            id: this.generateId(target),
            target
        };
    }

    finalizeJob(room, target, job){
        return job;
    }

    generateJobsForFlag(flag){
        if(!flag.room){
            return [];
        }
        return this.generateJobs(flag.room, flag);
    }

    generateTargets(room, flag){
        return [];
    }

}

module.exports = BaseJob;