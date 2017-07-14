"use strict";

const BaseWorker = require('./base');

class DeliverWorker extends BaseWorker {
    constructor(){ super('deliver', { args: ['id', 'resource'], quota: ['stockpile', 'tower'], critical: 'spawn' }); }

    /// Job ///
    calculateCapacity(cluster, subtype, id, target, args){
        return target.getAvailableCapacity();
    }

    spawn(cluster, subtype){
        var structures = cluster.structures.spawn.concat(cluster.structures.extension);
        var targets = _.filter(structures, struct => struct.energy < struct.energyCapacity);
        return this.jobsForTargets(cluster, subtype, targets, { resource: RESOURCE_ENERGY });
    }

    stockpile(cluster, subtype){
        if(cluster.tagged.stockpile){
            var stockpile = _.filter(cluster.tagged.stockpile, target => target.getResource(RESOURCE_ENERGY) < 300000);
            return this.jobsForTargets(cluster, subtype, stockpile, { resource: RESOURCE_ENERGY });
        }else{
            return [];
        }
    }

    storage(cluster, subtype){
        var structures = _.filter(cluster.getAllMyStructures([STRUCTURE_STORAGE]), storage => storage.getStored() < storage.getCapacity() * 0.9 && storage.getResource(RESOURCE_ENERGY) < storage.getCapacity() * 0.6);
        var tagged = cluster.getTaggedStructures();
        return this.jobsForTargets(cluster, subtype, structures.concat(tagged.stockpile || []), { resource: RESOURCE_ENERGY });
    }

    tower(cluster, subtype){
        var structures = cluster.structures.tower;
        var targets = _.filter(structures, struct => struct.energy < struct.energyCapacity - 50);
        return this.jobsForTargets(cluster, subtype, targets, { resource: RESOURCE_ENERGY });
    }

    terminal(cluster, subtype){
        var terminals = _.filter(cluster.getAllMyStructures([STRUCTURE_STORAGE]), storage => storage.getStored() < storage.getCapacity() * 0.9);
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
        if(job.target && job.target.structureType == 'tower'){
            return super.jobValid(cluster, job) && job.target.getAvailableCapacity() > 50;
        }
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