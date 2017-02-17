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

    generateId(entity, subtype){
        if(subtype){
            return this.type+'-'+subtype+'-'+(entity.id || entity.name);
        }
        return this.type+'-'+(entity.id || entity.name);
    }

    generate(){
        var jobs = {};
        _.forEach(this.catalog.rooms, room => _.forEach(this.generateJobs(room), job => jobs[job.id] = job));
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

    addAllocation(jobs, jobId, allocation){
        if(jobId && _.has(jobs, jobId)){
            _.set(jobs, [jobId, 'allocated'], _.get(jobs, [jobId, 'allocated'], 0) + allocation);
            var job = _.get(jobs, jobId, false);
            return job && job.allocated >= job.capacity;
        }
        return false;
    }

    removeAllocation(jobs, jobId, allocation){
        if(jobId && _.has(jobs, jobId)){
            _.set(jobs, [jobId, 'allocated'], _.get(jobs, [jobId, 'allocated'], 0) - allocation);
            var job = _.get(jobs, jobId, false);
            return job && job.allocated < job.capacity;
        }
        return false;
    }

    getSubflag(flag){
        var flagparts = flag.name.split('-');
        if(flagparts.length > 2){
            return flagparts[1];
        }
        return false;
    }

}

module.exports = BaseJob;