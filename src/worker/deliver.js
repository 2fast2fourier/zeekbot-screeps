"use strict";

const BaseWorker = require('./base');

class DeliverWorker extends BaseWorker {
    constructor(){ super('deliver', { args: ['id', 'resource'] }); }

    /// Job ///
    calculateCapacity(cluster, subtype, id, target, args){
        return target.getResource(args.resource);
    }

    spawn(cluster, subtype){
        var structures = _.filter(cluster.getAllMyStructures([STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_TOWER]), struct => struct.getAvailableCapacity() > 0);
        return this.jobsForTargets(cluster, subtype, structures, { resource: RESOURCE_ENERGY });
    }

    storage(cluster, subtype){
        var structures = cluster.getAllMyStructures([STRUCTURE_STORAGE]);
        return this.jobsForTargets(cluster, subtype, structures, { resource: RESOURCE_ENERGY });
    }

    /// Creep ///

    jobValid(cluster, job){
        return super.jobValid(cluster, job) && job.target.getAvailableCapacity() > 0;
    }

    continueJob(cluster, creep, opts, job){
        return super.continueJob(cluster, creep, opts, job) && creep.getResource(job.args.resource) > 0;
    }

    canBid(cluster, creep, opts){
        return creep.getStored() > 0;
    }

    calculateBid(cluster, creep, opts, job, allocation, distance){
        if(creep.getResource(job.args.resource) == 0){
            return false;
        }
        return distance / 50;
    }

    process(cluster, creep, opts, job, target){
        if(creep.pos.getRangeTo(target) > 1){
            this.move(creep, target);
        }else{
            creep.transfer(target, job.args.resource);
        }
    }

}

module.exports = DeliverWorker;