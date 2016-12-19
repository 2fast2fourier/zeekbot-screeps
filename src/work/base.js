"use strict";

var SimpleWorker = require('./simple');

class BaseWorker extends SimpleWorker {
    constructor(catalog, type, opts){
        super(catalog, type, opts);
    }

    getOpenJobs(){
        return this.catalog.jobs.getOpenJobs(this.type);
    }

    getCurrentJob(creep){
        if(creep.memory.jobType !== this.type){
            return false;
        }
        return this.catalog.jobs.getJob(this.type, creep.memory.jobId);
    }

    getTarget(creep){
        return _.get(this.getCurrentJob(creep), 'target', false);
    }

    getJobDistance(creep, job){
        return this.catalog.getRealDistance(creep, job.target);
        // return Math.min(creep.pos.getRangeTo(job.target), 99);
    }

    calcAvailRatio(job, allocation){
        return 1 - Math.min(1, Math.max(0, job.capacity - job.allocated)/allocation);
    }

    stillValid(creep, opts){
        var job = this.getCurrentJob(creep);
        return job && job.target && this.isValid(creep, opts, job, job.target);
    }

    isValid(creep, opts, job, target){
        return super.stillValid(creep, opts);
    }

    canBid(creep, opts){
        if(this.requiresEnergy){
            return this.catalog.getResource(creep, RESOURCE_ENERGY) > 0;
        }
        return true;
    }

    bid(creep, opts){
        if(!this.canBid(creep, opts)){
            return false;
        }
        // var start = Game.cpu.getUsed();
        var lowestBid = 99999999;
        var allocation = this.calculateAllocation(creep, opts);
        if(!allocation){
            return false;
        }
        var jobs = this.getOpenJobs();
        var result = _.reduce(jobs, (result, job) =>{
            var distance = this.getJobDistance(creep, job);
            if(opts.maxRange > 0 && distance > opts.maxRange){
                return result;
            }
            if(opts.local && creep.pos.roomName != _.get(job, 'target.pos.roomName')){
                return result;
            }
            var bid = this.calculateBid(creep, opts, job, allocation, distance);
            if(bid !== false){
                bid += _.get(opts, 'priority', 0);
                if(bid < lowestBid){
                    lowestBid = bid;
                    return { allocation, bid, job, type: this.type };
                }
            }
            return result;
        }, false);
        // console.log(this.type, Game.cpu.getUsed() - start);
        return result;
    }

    calculateAllocation(creep, opts){ console.log('calculateAllocation not implemented', this.type); }

    calculateBid(creep, opts, job, allocation){ console.log('calculateBid not implemented', this.type); }
    
    process(creep, opts){
        var job = this.getCurrentJob(creep);
        if(!job || !job.target){
            return;
        }
        this.processStep(creep, job, job.target, opts);
    }

    processStep(creep, job, target, opts){ console.log('processStep not implemented', this.type); }

}

module.exports = BaseWorker;