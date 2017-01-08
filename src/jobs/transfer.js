"use strict";

var BaseJob = require('./base');
var Util = require('../util');

var prices = {
    X: 0.45
}

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

    generateTerminalTransfers(){
        var terminalCount = _.size(this.catalog.buildings.terminal);
        return _.reduce(this.catalog.resources, (result, data, type)=>{
            if(data.totals.terminal < Memory.settings.terminalIdealResources * terminalCount){
                var target = Util.helper.firstNotFull(this.catalog.buildings.terminal);
                var storage = _.first(_.sortBy(_.filter(data.sources, source => source.structureType != STRUCTURE_TERMINAL), source => source.pos.getRangeTo(target)));
                result.push({
                    pickup: storage || false,
                    target,
                    resource: type,
                    amount: Memory.settings.terminalIdealResources - data.totals.terminal,
                    subtype: 'terminal',
                    id: 'transfer-terminal-'+type,
                    priority: 1
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
            if(target.mineralType && resource && target.mineralType != resource){
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
        if(!job.target){
            var storage = _.filter(this.catalog.buildings.storage, storage => this.catalog.getAvailableCapacity(storage) >= Memory.settings.transferStoreThreshold);
            job.target = _.first(_.sortBy(storage, store => store.pos.getRangeTo(job.pickup)));
        }
        if(!job.pickup && job.pickup !== false){
            job.pickup = _.first(_.sortBy(this.catalog.resources[job.resource].sources, source => source.pos.getRangeTo(job.target)));
        }
        if(job.subtype == 'store'){
            job.id = this.generateId(job.pickup, job.subtype+'-'+job.resource);
            job.priority = 1 + Math.max(0, 1 - job.amount / Memory.settings.transferStoreThreshold);
        }
        if(job.subtype == 'deliver'){
            job.id = this.generateId(job.target, job.subtype+'-'+job.resource);
            job.priority = Math.max(0, 1 - job.amount / Memory.settings.transferRefillThreshold);
        }
        job.capacity = job.amount;
        job.allocated = 0;
        return job;
    }

    levelTerminals(){
        var transferred = false;
        var ideal = Memory.settings.terminalIdealResources;
        var terminalCount = _.size(this.catalog.buildings.terminal);
        _.forEach(this.catalog.resources, (data, type)=>{
            if(type == RESOURCE_ENERGY){
                return;
            }
            // _.forEach(data.terminal, terminal => console.log(type, terminal, Util.getResource(terminal, type)))
            //{ total: 0, sources: [], storage: [], terminal: [], totals: { storage: 0,  terminal: 0 } }
            if(!transferred && data.totals.terminal > ideal){
                var terminal = _.first(_.filter(data.terminal, terminal => Util.getResource(terminal, type) > ideal && Util.getResource(terminal, RESOURCE_ENERGY) > 40000));
                var target = _.first(Util.sort.resource(_.filter(this.catalog.buildings.terminal, entity => Util.getResource(entity, type) < ideal), type));
                var sending = Math.min(ideal, source - ideal);
                if(terminal && target && sending >= 100){
                    var source = Util.getResource(terminal, type);
                    var dest = Util.getResource(target, type);
                    console.log('transfer', type, terminal, source, 'to', target, dest, sending);
                    transferred = terminal.send(type, sending, target.pos.roomName) == OK;
                }
            }
        });
        return transferred;
    }
// {
// 	id : "55c34a6b5be41a0a6e80c68b", 
// 	created : 13131117, 
// 	active: true,
// 	type : "sell"    
// 	resourceType : "OH", 
// 	roomName : "W1N1", 
// 	amount : 15821, 
// 	remainingAmount : 30000,
// 	totalAmount : 50000,
// 	price : 2.95    
// }
    sellOverage(){
        var sold = false;
        var terminalCount = _.size(this.catalog.buildings.terminal);
        var ideal = Memory.settings.terminalIdealResources;
        var max = terminalCount * ideal;
        var orders = {};
        _.forEach(Game.market.orders, order =>{
            if(order.active && order.type == ORDER_SELL){
                orders[order.resourceType] = order;
            }
        });
        _.forEach(this.catalog.resources, (data, type)=>{
            var overage = data.totals.terminal - max;
            if(!sold && type != RESOURCE_ENERGY && overage > 1000 && Game.market.credits > 10000){
                if(!_.has(prices, type)){
                    console.log('want to sell', type, 'but no price');
                    return;
                }
                var existing = orders[type];
                if(!existing){
                    var source = _.first(_.sortBy(data.terminal, terminal => -Util.getResource(terminal, type)));
                    var holding = Util.getResource(source, type);
                    console.log('selling from', source.pos.roomName, overage, holding, prices[type]);
                    sold = Game.market.createOrder(ORDER_SELL, type, prices[type], Math.min(overage, holding), source.pos.roomName) == OK;
                    if(sold){
                        console.log('created order', type, Math.min(overage, holding));
                    }
                }else if(existing && existing.remainingAmount < 250){
                    //extendOrder(orderId, addAmount)
                    console.log('cancelling extending order', existing.orderId, existing.remainingAmount, overage);
                    sold = Game.market.cancelOrder(existing.orderId) == OK;
                }

            }
        });
    }

    generate(){
        var targetLists = [];

        targetLists.push(this.generateEnergyTransfers('terminal', 50000));
        targetLists.push(this.generateEnergyTransfers('lab', 2000));
        targetLists.push(this.generateLabTransfers());
        targetLists.push(this.generateTerminalTransfers());

        if(Util.interval(25)){
            if(!this.levelTerminals()){
                this.sellOverage();
            }
        }

        var jobs = _.map(_.flatten(targetLists), job => this.generateSecondaryTarget(job));
        // _.forEach(_.zipObject(_.map(jobs, 'id'), jobs), job => console.log(job.id, job.target, job.pickup, job.subtype, job.resource, job.amount));
        return this.postGenerate(_.zipObject(_.map(jobs, 'id'), jobs));
    }

}

module.exports = TransferJob;