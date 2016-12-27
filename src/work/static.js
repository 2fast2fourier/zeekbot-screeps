"use strict";

var SimpleWorker = require('./simple');

class StaticWorker extends SimpleWorker {
    constructor(catalog, type, opts){
        super(catalog, type, opts);
        this.capacity = this.capacity || 1;
    }

    stillValid(creep, opts){
        var target = Game.getObjectById(creep.memory.jobId);
        return target && super.stillValid(creep, opts) && this.isValid(creep, opts, target);
    }

    isValid(creep, opts, target){
        return true;
    }

    getTargets(){
        var jobs = Memory.jobs[this.type];
        if(jobs && jobs.length > 0){
            return jobs;
        }
        return [];
    }

    bid(creep, opts){
        if(!this.shouldBid(creep, opts)){
            return false;
        }
        var targetId = _.find(this.getTargets(), jobId => {
            var target = Game.getObjectById(jobId);
            var allocated = _.get(this.catalog.jobs.staticAllocation, [this.type, jobId], 0);
            return target && allocated < this.capacity && this.canBid(creep, opts, target);
        });
        var finalTarget = Game.getObjectById(targetId);
        // console.log(creep, 'bid for', finalTarget, _.get(this.catalog.jobs.staticAllocation, [this.type, targetId], 0), targetId);
        if(finalTarget){
            return {
                job: { id: finalTarget.id, target: finalTarget },
                type: this.type,
                allocation: 1,
                bid: this.calculateBid(creep, opts, finalTarget)
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

    calculateBid(creep, opts, target){
        var distance = this.catalog.getRealDistance(creep, target) / this.distanceWeight;
        if(this.requiresEnergy){
            return (1 - creep.carry.energy / creep.carryCapacity) / 5 + distance;
        }else{
            return distance;
        }
    }

    process(creep, opts){
        var target = Game.getObjectById(creep.memory.jobId);
        if(!target){
            return false;
        }
        return this.processStep(creep, target, opts);
    }

    processStep(creep, target, opts){
        return false;
    }

}

module.exports = StaticWorker;