"use strict";

const BaseWorker = require('./base');

class PickupWorker extends BaseWorker {
    constructor(){ super('pickup', { args: ['id', 'resource'], critical: 'pickup', quota: ['mineral'], minCPU: 4500, priority: 0.25 }); }

    /// Job ///
    calculateCapacity(cluster, subtype, id, target, args){
        return target.getResource(args.resource);
    }

    pickup(cluster, subtype){
        if(!cluster.cache.pickup || cluster.cache.pickupUpdate < Game.time){
            var structs = cluster.getAllStructures([STRUCTURE_STORAGE, STRUCTURE_CONTAINER, STRUCTURE_LINK]);
            structs = _.filter(structs, struct => struct.structureType != STRUCTURE_LINK || !cluster.state.links.sources[struct.id]);
            cluster.cache.pickup = _.map(structs, 'id');
            cluster.cache.pickupUpdate = Game.time + 500;
        }
        var energy = _.filter(cluster.findAll(FIND_DROPPED_RESOURCES), { resourceType: RESOURCE_ENERGY });
        var storage = _.filter(Game.getObjects(cluster.cache.pickup), struct => struct && struct.getResource(RESOURCE_ENERGY) > 0);
        var terminals = _.filter(cluster.structures.terminal, terminal => terminal.getResource(RESOURCE_ENERGY) > 60000);
        return this.jobsForTargets(cluster, subtype, energy.concat(storage).concat(terminals), { resource: RESOURCE_ENERGY });
    }

    harvest(cluster, subtype){
        if(!cluster.cache.harvest || cluster.cache.harvestUpdate < Game.time){
            var rooms = cluster.roles.core.concat(cluster.roles.harvest);
            var containers = _.map(rooms, room => _.filter(cluster.getStructuresByType(room, STRUCTURE_CONTAINER), struct => !struct.hasTag('stockpile')));
            containers.push(_.compact(Game.getObjects(cluster.state.links.storage)));
            cluster.cache.harvest = _.map(_.flatten(containers), 'id');
            cluster.cache.harvestUpdate = Game.time + 500;
        }
        var storage = _.filter(Game.getObjects(cluster.cache.harvest), struct => struct && struct.getResource(RESOURCE_ENERGY) > 0);
        var energy = _.map(cluster.roomflags.harvest, room => _.filter(cluster.find(room, FIND_DROPPED_RESOURCES), { resourceType: RESOURCE_ENERGY }));
        return this.jobsForTargets(cluster, subtype, storage.concat(_.flatten(energy)), { resource: RESOURCE_ENERGY });
    }

    mineral(cluster, subtype){
        if(!cluster.cache.mineral || cluster.cache.mineralUpdate < Game.time){
            cluster.cache.mineral = _.map(cluster.getAllStructures([STRUCTURE_CONTAINER]), 'id');
            cluster.cache.mineralUpdate = Game.time + 500;
        }
        var containers = _.filter(Game.getObjects(cluster.cache.mineral), struct => struct && struct.getStored() > struct.getResource(RESOURCE_ENERGY));
        var resources = _.filter(cluster.findAll(FIND_DROPPED_RESOURCES), resource => resource.resourceType != RESOURCE_ENERGY && resource.amount > 200);
        var jobs = [];
        for(let store of containers){
            _.forEach(store.getResourceList(), (amount, type)=>{
                if(type != RESOURCE_ENERGY && amount > 0){
                    jobs.push(this.createJob(cluster, subtype, store, { resource: type }));
                }
            });
        }
        return jobs.concat(_.map(resources, resource => this.createJob(cluster, subtype, resource, { resource: resource.resourceType })));
    }

    generateAssignments(cluster, assignments, quota){
        assignments.harvest = _.zipObject(_.map(cluster.roles.harvest, 'name'),
                                          _.map(cluster.roles.harvest, room => _.size(cluster.find(room, FIND_SOURCES))));

        for(let coreRoom of cluster.roles.core){
            assignments.harvest[coreRoom.name] = 1;
        }
        for(let keepRoom of cluster.roles.keep){
            assignments.harvest[keepRoom.name] = _.size(cluster.find(keepRoom, FIND_SOURCES)) + 2;
        }
        if(_.size(cluster.structures.storage) > 0){
            quota.harvesthauler = _.sum(assignments.harvest) * 24;
        }
    }

    /// Creep ///

    allocate(cluster, creep, opts, job){
        return creep.getAvailableCapacity();
    }

    jobValid(cluster, job){
        return super.jobValid(cluster, job) && job.target.getResource(job.args.resource) > 0;
    }

    continueJob(cluster, creep, opts, job){
        return super.continueJob(cluster, creep, opts, job) && creep.getAvailableCapacity() > 10;
    }

    canBid(cluster, creep, opts){
        return creep.getAvailableCapacity() > 0;
    }

    calculateBid(cluster, creep, opts, job, distance){
        if(job.target.id == creep.memory.lastDeliver){
            return false;
        }
        return distance / 50 + Math.max(0, 1 - job.capacity / creep.carryCapacity);
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