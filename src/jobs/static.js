"use strict";

class StaticJob {
    constructor(catalog, type, opts){
        this.catalog = catalog;
        this.refresh = 0;
        this.capacity = 1;
        this.static = true;
        this.type = type;
        if(opts){
            _.assign(this, opts);
        }
        this.generateJob = this.generateJob.bind(this);
    }

    getType(){
        return this.type;
    }

    generateId(entity){
        return (entity.id || entity.name);
    }

    generate(){
        if(this.refresh > 0 && !this.catalog.interval(this.refresh)){
            return {};
        }

        var finalTargets = this.finalizeTargetList(this.generateAllTargets());

        Memory.jobs[this.type] = this.generateJobs(finalTargets);
        return {};
    }

    generateAllTargets(){
        var targetLists = _.map(this.catalog.rooms, room => this.generateTargets(room));
        if(this.flagPrefix){
            var flagTargetLists = _.map(this.catalog.getFlagsByPrefix(this.flagPrefix), flag => this.generateTargetsForFlag(flag));
            if(flagTargetLists.length > 0){
                targetLists = targetLists.concat(flagTargetLists);
            }
        }
        return _.flatten(targetLists);
    }

    generateTargets(room, flag){
        return [];
    }

    generateTargetsForUnknownRoom(name, flag){
        return [];
    }

    generateTargetsForFlag(flag){
        if(flag.room){
            return this.generateTargets(flag.room, flag);
        }
        return this.generateTargetsForUnknownRoom(flag.pos.roomName, flag);
    }

    finalizeTargetList(targets){
        return targets;
    }

    generateJobs(targets){
        return _.map(targets, this.generateJob);
    }

    generateJob(target){
        return target.id;
    }

    addAllocation(jobs, jobId, allocation){
        if(jobId){
            _.set(this.catalog.jobs.staticAllocation, [this.type, jobId], _.get(this.catalog.jobs.staticAllocation, [this.type, jobId], 0) + allocation);
            // console.log('add', jobId, _.get(this.catalog.jobs.staticAllocation, [this.type, jobId], 0));
        }
        return false;
    }

    removeAllocation(jobs, jobId, allocation){
        if(jobId){
            _.set(this.catalog.jobs.staticAllocation, [this.type, jobId], _.get(this.catalog.jobs.staticAllocation, [this.type, jobId], 0) - allocation);
            console.log('remove', jobId, _.get(this.catalog.jobs.staticAllocation, [this.type, jobId], 0));
        }
        return false;
    }

}

module.exports = StaticJob;