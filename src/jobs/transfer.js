"use strict";

var StaticJob = require('./static');
var Util = require('../util');

class TransferJob extends StaticJob {
    constructor(catalog){ super(catalog, 'transfer', { refresh: 10 }); }

    generateEnergyTransfers(type, need){
        return _.map(_.filter(this.catalog.buildings[type], building => this.catalog.getResource(building, RESOURCE_ENERGY) < need * 0.95), building => {
            return {
                target: building,
                resource: RESOURCE_ENERGY,
                amount: need,
                subtype: 'deliver'
            };
        });
    }

    generateTerminalTransfers(){
        var targetAmount = Memory.settings.terminalIdealResources * _.size(this.catalog.buildings.terminal);
        var totalStorage = _.size(this.catalog.buildings.storage) * 1000000;
        return _.reduce(this.catalog.resources, (result, data, type)=>{
            if(type != RESOURCE_ENERGY && data.totals.terminal < targetAmount && data.totals.storage > 0){
                var storage = _.first(data.storage);
                result.push({
                    target: storage,
                    resource: type,
                    amount: targetAmount,
                    subtype: 'terminal'
                });
            }
            return result;
        }, []);
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
            if(target.mineralType && target.mineralType != resource){
                result.push({
                    target,
                    resource: target.mineralType,
                    amount: 0,
                    subtype: 'store'
                });
                return result;
            }
            var amount = this.catalog.getResource(target, resource);
            if(amount < min && this.catalog.resources[resource].totals.storage > 0){
                result.push({
                    target,
                    resource,
                    amount: Memory.settings.labIdealMinerals,
                    subtype: 'deliver'
                });
            }
            if(amount > max){
                result.push({
                    target,
                    resource,
                    amount: Memory.settings.labIdealMinerals,
                    subtype: 'store'
                });
            }
            return result;
        }, []);
    }

    // generateSecondaryTarget(job){
    //     if(!job.target){
    //         var storage = _.filter(this.catalog.buildings.storage, storage => this.catalog.getAvailableCapacity(storage) >= Memory.settings.transferStoreThreshold);
    //         job.target = _.first(_.sortBy(storage, store => store.pos.getRangeTo(job.pickup)));
    //     }
    //     if(!job.pickup && job.pickup !== false){
    //         job.pickup = _.first(_.sortBy(this.catalog.resources[job.resource].sources, source => source.pos.getRangeTo(job.target)));
    //     }
    //     if(job.subtype == 'store'){
    //         job.id = this.generateId(job.pickup, job.subtype+'-'+job.resource);
    //         job.priority = 1 + Math.max(0, 1 - job.amount / Memory.settings.transferStoreThreshold);
    //     }
    //     if(job.subtype == 'deliver'){
    //         job.id = this.generateId(job.target, job.subtype+'-'+job.resource);
    //         job.priority = Math.max(0, 1 - job.amount / Memory.settings.transferRefillThreshold);
    //     }
    //     job.capacity = job.amount;
    //     job.allocated = 0;
    //     return job;
    // }

    generateAllTargets(){
        var targetLists = [];

        targetLists.push(this.generateEnergyTransfers('terminal', 50000));
        targetLists.push(this.generateEnergyTransfers('lab', 2000));
        targetLists.push(this.generateLabTransfers());
        targetLists.push(this.generateTerminalTransfers());

        return _.flatten(targetLists);
    }

    generateJob(target){
        // {
        //     target,
        //     resource,
        //     amount: Memory.settings.labIdealMinerals,
        //     subtype: 'store' | 'deliver' | 'terminal'
        // }
        // result: 'deliver-H-1000-123456abcdef123456'
        return target.subtype + '-' + target.resource + '-' + target.amount + '-' + target.target.id;
    }

}

module.exports = TransferJob;