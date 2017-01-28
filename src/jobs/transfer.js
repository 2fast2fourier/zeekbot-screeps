"use strict";

var StaticJob = require('./static');
var Util = require('../util');

class TransferJob extends StaticJob {
    constructor(catalog){ super(catalog, 'transfer', { refresh: 10 }); }

    generateEnergyTransfers(type, need, full){
        return _.map(_.filter(this.catalog.buildings[type], building => this.catalog.getResource(building, RESOURCE_ENERGY) < need * (full ? 1 : 0.95)), building => {
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

    generateNukeTransfers(){
        return _.reduce(this.catalog.buildings.nuker, (result, nuker)=>{
            if(Util.getResource(nuker, RESOURCE_GHODIUM) < 5000){
                result.push({
                    target: nuker,
                    resource: RESOURCE_GHODIUM,
                    amount: 5000,
                    subtype: 'deliver'
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
                delete Memory.transfer.lab[labId];
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
            if(!resource){
                return result;
            }
            var amount = this.catalog.getResource(target, resource);
            if(amount < min && this.catalog.resources[resource].total > 0){
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

    generateAllTargets(){
        var targetLists = [];

        targetLists.push(this.generateLabTransfers());
        targetLists.push(this.generateNukeTransfers());
        targetLists.push(this.generateEnergyTransfers('terminal', 50000));
        targetLists.push(this.generateEnergyTransfers('lab', 2000));
        targetLists.push(this.generateEnergyTransfers('nuker', 300000, true));
        targetLists.push(this.generateTerminalTransfers());

        return _.flatten(targetLists);
    }

    generateJob(target){
        return target.subtype + '-' + target.resource + '-' + target.amount + '-' + target.target.id;
    }

}

module.exports = TransferJob;