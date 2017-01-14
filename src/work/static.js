"use strict";

var SimpleWorker = require('./simple');

class StaticWorker extends SimpleWorker {
    constructor(catalog, type, opts){
        super(catalog, type, opts);
        this.capacity = this.capacity || 1;
        this.allocation = this.allocation || 1;
        this.getTargetData = this.getTargetData.bind(this);
    }

    stillValid(creep, opts){
        var job = this.getTargetData(creep.memory.jobId);
        return job.target && super.stillValid(creep, opts) && this.isValid(creep, opts, job.target, job);
    }

    isValid(creep, opts, target, job){
        return true;
    }

    getTargets(){
        var jobs = Memory.jobs[this.type];
        if(jobs && jobs.length > 0){
            return jobs;
        }
        return [];
    }

    getTargetData(jobId){
        if(this.multipart){
            var result =  _.zipObject(this.multipart, jobId.split('-'));
            result.targetId = result.id;
            result.target = Game.getObjectById(result.targetId);
            result.id = jobId;
            return result;
        }
        return {
            id: jobId,
            target: Game.getObjectById(jobId),
            targetId: jobId
        };
    }

    jobExists(jobId){
        return _.includes(this.getTargets(), jobId);
    }

    bid(creep, opts){
        if(!this.shouldBid(creep, opts)){
            return false;
        }
        var targetId = _.find(this.getTargets(), jobId => {
            var job = this.getTargetData(jobId);
            var allocated = _.get(this.catalog.jobs.staticAllocation, [this.type, jobId], 0);
            return job.target && allocated < this.capacity && this.canBid(creep, opts, job.target, job);
        });
        if(!targetId){
            return false;
        }
        var job = this.getTargetData(targetId);
        // console.log(creep, 'bid for', job.target, _.get(this.catalog.jobs.staticAllocation, [this.type, targetId], 0), targetId);
        if(job.target){
            return {
                job,
                type: this.type,
                allocation: this.allocation,
                bid: this.calculateBid(creep, opts, job.target, job) + _.get(opts, 'priority', 0)
            }
        }
        return false;
    }

    canBid(creep, opts, target){
        return true;
    }

    shouldBid(creep, opts){
        if(this.requiresEnergy){
            return creep.carry.energy > 0;
        }else{
            return true;
        }
    }

    calculateBid(creep, opts, target, job){
        var distance = this.catalog.getRealDistance(creep, target) / this.distanceWeight;
        if(this.requiresEnergy){
            return (1 - creep.carry.energy / creep.carryCapacity) / 5 + distance;
        }else{
            return distance;
        }
    }

    process(creep, opts){
        var job = this.getTargetData(creep.memory.jobId);
        if(!job.target){
            return false;
        }
        return this.processStep(creep, job.target, opts, job);
    }

    processStep(creep, target, opts, job){
        return false;
    }

}

module.exports = StaticWorker;