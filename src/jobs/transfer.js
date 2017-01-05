"use strict";

var BaseJob = require('./base');

class TransferJob extends BaseJob {
    constructor(catalog){ super(catalog, 'transfer'); }

    generateEnergyTransfers(type, need){
        return _.map(_.filter(this.catalog.buildings[type], building => this.catalog.getResource(building, RESOURCE_ENERGY) < need), building => {
            return {
                target: building,
                resource: RESOURCE_ENERGY,
                amount: need - this.catalog.getResource(building, RESOURCE_ENERGY),
                subtype: 'deliver'
            };
        });
    }

    generateLabTransfers(){
        var min = Memory.settings.labIdealMinerals - Memory.settings.transferRefillThreshold;
        var max = Memory.settings.labIdealMinerals + Memory.settings.transferStoreThreshold;
        return _.reduce(Memory.transfer.lab, (result, resource, labId) => {
            var target = Game.structures[labId];
            if(!target){
                console.log('invalid lab', labId);
                return result;
            }
            if(resource && target.mineralType != resource){
                result.push({
                    pickup: target,
                    resource: target.mineralType,
                    amount: target.mineralAmount,
                    subtype: 'store'
                });
                return result;
            }
            var amount = this.catalog.getResource(target, resource);
            if(amount < min){
                result.push({
                    target,
                    resource,
                    amount: Memory.settings.labIdealMinerals - amount,
                    subtype: 'deliver'
                });
            }
            if(amount > max){
                result.push({
                    pickup: target,
                    resource,
                    amount: amount - Memory.settings.labIdealMinerals,
                    subtype: 'store'
                });
            }
            return result;
        }, []);
    }

    generateSecondaryTarget(job){
        if(job.subtype == 'store'){
            var storage = _.filter(this.catalog.buildings.storage, storage => this.catalog.getAvailableCapacity(storage) >= Memory.settings.transferStoreThreshold);
            job.target = _.first(_.sortBy(storage, store => store.pos.getRangeTo(job.pickup)));
            job.id = this.generateId(job.pickup, job.subtype+'-'+job.resource);
            job.priority = 1 + Math.max(0, 1 - job.amount / Memory.settings.transferStoreThreshold);
        }
        if(job.subtype == 'deliver'){
            job.pickup = _.first(_.sortBy(this.catalog.resources[job.resource].sources, source => source.pos.getRangeTo(job.target)));
            job.id = this.generateId(job.target, job.subtype+'-'+job.resource);
            job.priority = Math.max(0, 1 - job.amount / Memory.settings.transferRefillThreshold);
        }
        job.capacity = job.amount;
        job.allocated = 0;
        return job;
    }

    generate(){
        var targetLists = [];

        targetLists.push(this.generateEnergyTransfers('terminal', 50000));
        targetLists.push(this.generateEnergyTransfers('lab', 2000));
        targetLists.push(this.generateLabTransfers());

        var jobs = _.map(_.flatten(targetLists), job => this.generateSecondaryTarget(job));
        // _.forEach(_.zipObject(_.map(jobs, 'id'), jobs), job => console.log(job.id, job.target, job.pickup, job.subtype, job.resource, job.amount));
        return this.postGenerate(_.zipObject(_.map(jobs, 'id'), jobs));
    }

}

module.exports = TransferJob;