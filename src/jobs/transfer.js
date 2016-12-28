"use strict";

var BaseJob = require('./base');

class TransferJob extends BaseJob {
    constructor(catalog){ super(catalog, 'transfer'); }

    generate(){
        var start = Game.cpu.getUsed();

        var energyStorage = _.filter(this.catalog.buildings.storage, storage => this.catalog.getResource(storage, RESOURCE_ENERGY) > 0);
        var jobs = _.reduce(Memory.transfer.energy, (result, need, id)=>{
            var target = Game.getObjectById(id);
            if(!target){
                return result;
            }
            var amount = need - this.catalog.getResource(target, RESOURCE_ENERGY);
            var pickup = _.first(this.catalog.sortByDistance(target, energyStorage));
            if(amount > 0 && pickup){
                var job = this.createJob(target, pickup, amount, RESOURCE_ENERGY);
                result[job.id] = job;
            }
            return result;
        }, {});
        
        var storage = _.filter(this.catalog.buildings.storage, storage => this.catalog.getAvailableCapacity(storage) > 0);
        jobs = _.reduce(Memory.transfer.lab, (result, resource, id)=>{
            var target = Game.getObjectById(id);
            if(!target){
                return result;
            }
            if(resource === 'store'){
                if(target.mineralAmount > Memory.settings.transferStoreThreshold){
                    var dropoff = _.first(this.catalog.sortByDistance(target, storage));
                    var job = this.createJob(dropoff, target, target.mineralAmount, target.mineralType);
                    result[job.id] = job;
                }
            }else if(target.mineralAmount > 0 && resource != target.mineralType){
                var dropoff = _.first(this.catalog.sortByDistance(target, storage));
                var job = this.createJob(dropoff, target, target.mineralAmount, target.mineralType);
                result[job.id] = job;
            }else if(resource){
                var amount = this.catalog.getCapacity(target) - this.catalog.getResource(target, resource);
                if(amount >= Memory.settings.transferRefillThreshold){
                    var sources = this.catalog.getStorageContainers(resource);
                    var pickup = _.first(_.sortBy(sources, source => -this.catalog.getResource(source, resource)));
                    var job = this.createJob(target, pickup, amount, resource);
                    result[job.id] = job;
                }
            }
            return result;
        }, jobs);

        this.profile(start);
        return this.postGenerate(jobs);
    }

    finalizeJob(room, target, job){
        return job;
    }

    createJob(target, pickup, amount, resource){
        return {
            allocated: 0,
            amount,
            capacity: amount,
            id: this.generateId(target)+'-'+resource,
            target,
            pickup,
            resource
        };
    }

}

module.exports = TransferJob;