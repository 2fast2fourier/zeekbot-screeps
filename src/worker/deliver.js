"use strict";

const BaseWorker = require('./base');

class DeliverWorker extends BaseWorker {
    constructor(){ super('deliver', { args: ['id', 'resource'], quota: ['stockpile'], critical: 'spawn' }); }

    /// Job ///
    calculateCapacity(cluster, subtype, id, target, args){
        return target.getAvailableCapacity();
    }

    spawn(cluster, subtype){
        var structures = _.filter(cluster.getAllMyStructures([STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_TOWER]), struct => struct.getAvailableCapacity() > 0);
        return this.jobsForTargets(cluster, subtype, structures, { resource: RESOURCE_ENERGY });
    }

    stockpile(cluster, subtype){
        var tagged = cluster.getTaggedStructures();
        return this.jobsForTargets(cluster, subtype, tagged.stockpile, { resource: RESOURCE_ENERGY });
    }

    storage(cluster, subtype){
        var structures = cluster.getAllMyStructures([STRUCTURE_STORAGE]);
        return this.jobsForTargets(cluster, subtype, structures, { resource: RESOURCE_ENERGY });
    }

    terminal(cluster, subtype){
        var terminals = cluster.getAllMyStructures([STRUCTURE_TERMINAL, STRUCTURE_STORAGE]);
        var jobs = [];
        for(let terminal of terminals){
            for(let resource of RESOURCES_ALL){
                if(resource != RESOURCE_ENERGY){
                    jobs.push(this.createJob(cluster, subtype, terminal, { resource }));
                }
            }
        }
        return jobs;
    }

    /// Creep ///

    allocate(cluster, creep, opts, job){
        return creep.getResource(job.args.resource);
    }

    jobValid(cluster, job){
        return super.jobValid(cluster, job) && job.target.getAvailableCapacity() > 0;
    }

    continueJob(cluster, creep, opts, job){
        return super.continueJob(cluster, creep, opts, job) && creep.getResource(job.args.resource) > 0;
    }

    canBid(cluster, creep, opts){
        return creep.getStored() > 0;
    }

    calculateBid(cluster, creep, opts, job, distance){
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
            creep.memory.lastDeliver = target.id;
        }
    }

}

module.exports = DeliverWorker;