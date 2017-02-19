"use strict";

const BaseWorker = require('./base');

class PickupWorker extends BaseWorker {
    constructor(){ super('pickup', { args: ['id', 'resource'] }); }

    /// Job ///
    calculateCapacity(cluster, subtype, id, target, args){
        return target.getResource(args.resource);
    }

    pickup(cluster, subtype){
        var energy = cluster.findAll(FIND_DROPPED_ENERGY);
        var storage = _.filter(cluster.getAllStructures([STRUCTURE_STORAGE, STRUCTURE_CONTAINER]), struct => struct.getResource(RESOURCE_ENERGY) > 0);
        return this.jobsForTargets(cluster, subtype, energy.concat(storage), { resource: RESOURCE_ENERGY });
    }

    mineral(cluster, subtype){
        //TODO
        return [];
    }

    /// Creep ///

    allocate(cluster, creep, opts, job){
        return creep.getAvailableCapacity();
    }

    jobValid(cluster, job){
        return super.jobValid(cluster, job) && job.target.getResource(job.args.resource) > 0;
    }

    continueJob(cluster, creep, opts, job){
        return super.continueJob(cluster, creep, opts, job) && creep.getAvailableCapacity() > 0;
    }

    canBid(cluster, creep, opts){
        return creep.getAvailableCapacity() > 0;
    }

    calculateBid(cluster, creep, opts, job, distance){
        if(job.target.id == creep.memory.lastDeliver){
            return false;
        }
        return distance / 50 + creep.getStored() / creep.getCapacity();
    }

    process(cluster, creep, opts, job, target){
        var result;
        if(target.resourceType){
            result = creep.pickup(target);
        }else{
            result = creep.withdraw(target, job.args.resource);
        }
        if(result == ERR_NOT_IN_RANGE){
            this.move(creep, target);
        }
    }

}

module.exports = PickupWorker;