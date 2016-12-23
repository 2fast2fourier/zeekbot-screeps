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
        var start = Game.cpu.getUsed();
        var jobs = {};
        _.forEach(this.getRooms(), room => _.forEach(this.generateJobs(room), job => jobs[job.id] = job));
        if(this.flagPrefix){
            _.forEach(this.catalog.getFlagsByPrefix(this.flagPrefix), flag => _.forEach(this.generateJobsForFlag(flag), job => jobs[job.id] = job));
        }
        this.profile(start);
        return this.postGenerate(jobs);
    }

    profile(start){
        var profile = Memory.stats.profile.job[this.getType()];
        var usage = Game.cpu.getUsed() - start;
        if(!profile){
            profile = {
                max: usage,
                min: usage,
                avg: usage,
                count: 1
            };
            Memory.stats.profile.job[this.getType()] = profile;
        }else{
            profile.avg = (profile.avg*profile.count + usage)/(profile.count+1);
            profile.count++;
            if(profile.max < usage){
                profile.max = usage;
            }
            if(profile.min > usage){
                profile.min = usage;
            }
        }
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