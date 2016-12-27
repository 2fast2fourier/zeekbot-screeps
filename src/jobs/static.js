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
        if(this.refresh > 0){
            if(_.get(Memory.jobUpdateTime, this.type, 0) > Game.time){
                return {};
            }
            Memory.jobUpdateTime[this.type] = Game.time + this.refresh;
        }

        console.log('refreshing', this.type);
        var targetLists = _.map(this.catalog.rooms, room => this.generateTargets(room));
        if(this.flagPrefix){
            var flagTargetLists = _.map(this.catalog.getFlagsByPrefix(this.flagPrefix), flag => this.generateTargetsForFlag(flag));
            if(flagTargetLists.length > 0){
                targetLists = targetLists.concat(flagTargetLists);
            }
        }
        var finalTargets = this.finalizeTargetList(_.flatten(targetLists));

        Memory.jobs[this.type] = this.generateJobs(finalTargets);
        return {};
    }

    generateJobs(targets){
        return _.map(targets, this.generateJob);
    }

    generateJob(target){
        return target.id;
    }

    calculatePriority(target){
        return 0;
    }

    finalizeTargetList(targets){
        return targets;
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