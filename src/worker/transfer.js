"use strict";

const BaseWorker = require('./base');
const Util = require('../util');

class TransferWorker extends BaseWorker {
    constructor(){ super('transfer', { args: ['id', 'action', 'resource', 'amount'], quota: true, minCPU: 7500 }); }

    generateEnergyTransfers(cluster, type, need){
        return cluster.structures[type].reduce((result, struct) => {
            let energy = struct.getResource(RESOURCE_ENERGY);
            if(energy < need - 200){
                result.push(this.createJob(cluster, 'transfer', struct, { action: 'deliver', resource: RESOURCE_ENERGY, amount: need }));
            }
            return result;
        }, []);
    }

    generateTerminalTransfers(cluster){
        var targetAmount = 5000 * _.size(cluster.structures.terminal) + 5000;
        return _.reduce(cluster.resources, (result, data, type)=>{
            if(type != RESOURCE_ENERGY && data.totals.terminal < targetAmount && data.totals.storage > 0){
                var storage = _.first(data.storage);
                result.push(this.createJob(cluster, 'transfer', storage, { action: 'terminal', resource: type, amount: targetAmount }));
            }
            return result;
        }, []);
    }

    generateOffloadTransfers(cluster){
        var onload = cluster.tagged.onload;
        if(!onload || onload.length == 0){
            return [];
        }
        return _.reduce(cluster.tagged.offload, (result, struct) =>{
            var resources = struct.getResourceList();
            for(var type in resources){
                if(type != RESOURCE_ENERGY && resources[type] > 0){
                    result.push(this.createJob(cluster, 'transfer', struct, { action: 'offload', resource: type, amount: 0 }));
                }
            }
            return result;
        }, []);
    }

    generateTerminalEnergyTransfers(cluster){
        return cluster.structures.terminal.reduce((result, struct) => {
            let energy = struct.getResource(RESOURCE_ENERGY);
            if(energy > 50000){
                result.push(this.createJob(cluster, 'transfer', struct, { action: 'store', resource: RESOURCE_ENERGY, amount: 50000 }));
            }
            return result;
        }, []);
    }

    generateLabTransfers(cluster){
        var min = 2000;
        var max = 2750;
        return _.reduce(cluster.transfer, (result, resource, labId) => {
            var target = Game.structures[labId];
            if(!target){
                console.log('invalid lab', labId);
                delete cluster.transfer[labId];
                return result;
            }
            if(resource && resource.startsWith('store')){
                var parts = resource.split('-');
                var wrongType = target.mineralType && target.mineralType != parts[1];
                if(wrongType || target.mineralAmount >= 500){
                    result.push(this.createJob(cluster, 'transfer', target, { action: 'store', resource: target.mineralType, amount: 0 }));
                }
                return result;
            }
            if(target.mineralType && target.mineralType != resource){
                result.push(this.createJob(cluster, 'transfer', target, { action: 'store', resource: target.mineralType, amount: 0 }));
                return result;
            }
            if(resource){
                var amount = target.getResource(resource);
                if(amount < min && cluster.resources[resource].stored > 0){
                    result.push(this.createJob(cluster, 'transfer', target, { action: 'deliver', resource, amount: 2500 }));
                }
                if(amount > max){
                    result.push(this.createJob(cluster, 'transfer', target, { action: 'store', resource, amount: 2500 }));
                }
            }
            return result;
        }, []);
    }

    /// Job ///

    transfer(cluster, subtype){
        let jobLists = [];
        jobLists.push(this.generateEnergyTransfers(cluster, STRUCTURE_LAB, 2000));
        jobLists.push(this.generateEnergyTransfers(cluster, STRUCTURE_TERMINAL, 50000));
        jobLists.push(this.generateEnergyTransfers(cluster, STRUCTURE_NUKER, 300000));
        jobLists.push(this.generateLabTransfers(cluster));
        if(cluster.structures.terminal.length > 0){
            jobLists.push(this.generateTerminalTransfers(cluster));
            jobLists.push(this.generateTerminalEnergyTransfers(cluster));
            jobLists.push(this.generateOffloadTransfers(cluster));
        }
        return _.flatten(jobLists);
    }

    jobValid(cluster, job){
        if(!super.jobValid(cluster, job)){
            return false;
        }
        var resource = job.args.resource;
        var targetResources = job.target.getResource(resource);
        if(job.args.action == 'store' || job.args.action == 'offload'){
            return targetResources > job.args.amount;
        }else if(job.args.action == 'deliver'){
            return targetResources < job.args.amount && cluster.resources[resource].stored > 0;
        }else if(job.args.action == 'terminal'){
            return cluster.resources[resource].totals.terminal < job.args.amount && cluster.resources[resource].totals.storage > 0;
        }
    }

    validate(cluster, creep, opts, target, job){
        var resource = job.args.resource;
        var currentResources = creep.getResource(resource);
        var targetResources = job.target.getResource(resource);
        if(job.args.action == 'store' || job.args.action == 'offload'){
            if(currentResources > 0){
                return true;
            }else{
                return targetResources > job.amount;
            }
        }else if(job.args.action == 'deliver'){
            if(currentResources > 0){
                return targetResources < job.amount;
            }else{
                return targetResources < job.amount && cluster.resources[resource].stored > 0;
            }
        }else if(job.args.action == 'terminal'){
            if(currentResources > 0){
                return cluster.resources[resource].totals.terminal < job.amount;
            }else{
                return cluster.resources[resource].totals.terminal < job.amount && cluster.resources[resource].totals.stored > 0;
            }
        }
        console.log('invalid type', job.id, creep, job.args.action);
        return false;
    }

    /// Creep ///

    // continueJob(cluster, creep, opts, job){
    //     return super.continueJob(cluster, creep, opts, job) && this.validate(cluster, creep, opts, job.target, job);
    // }

    canBid(cluster, creep, opts){
        return creep.ticksToLive > 100;
    }

    keepDeadJob(cluster, creep, opts, job){
        var resource = job.args.resource;
        var current = creep.getResource(resource);
        if(job.args.action == 'store' || job.args.action == 'terminal' || job.args.action == 'offload'){
            return current > 0;
        }else if(job.args.action == 'deliver'){
            return current > 0 && job.target && job.target.getResource(resource) < job.args.amount;
        }
    }

    calculateBid(cluster, creep, opts, job, distance){
        if(creep.getStored() > 0 && creep.getResource(job.args.resource) == 0){
            return false;
        }
        return distance / 50;
    }

    start(cluster, creep, opts, job){
        super.start(cluster, creep, opts, job);
        creep.memory.transferPickup = false;
        creep.memory.transferDeliver = false;
    }

    process(cluster, creep, opts, job, target){
        var type = job.args.resource;
        var action = job.args.action;
        var deliver = false;
        var pickup = false;
        var target = false;
        var resources = creep.getResource(type);
        if(resources > 0){
            creep.memory.transferPickup = false;
            deliver = this.getDeliver(cluster, creep, job, resources, action);
            target = deliver.target;
        }else{
            creep.memory.transferDeliver = false;
            pickup = this.getPickup(cluster, creep, job, action);
            target = pickup.target;
        }
        if(target && creep.pos.getRangeTo(target) > 1){
            this.move(creep, target);
        }else if(deliver){
            if(creep.transfer(deliver.target, type, deliver.amount) == OK){
                creep.memory.job = false;
                creep.memory.jobType = false;
            }
        }else if(pickup){
            creep.withdraw(pickup.target, type, Math.min(creep.getCapacity() - creep.getStored(), pickup.amount));
        }
    }
    
    end(cluster, creep, opts, job){
        super.end(cluster, creep, opts, job);
        creep.memory.transferPickup = false;
        creep.memory.transferDeliver = false;
    }

    getPickup(cluster, creep, job, action){
        let type = job.args.resource;
        if(creep.memory.transferPickup){
            var target = Game.getObjectById(creep.memory.transferPickup);
            if(target && target.getResource(type) > 0){
                return {
                    target,
                    amount: Math.min(target.getResource(type), Math.max(0, job.args.amount - job.target.getResource(type)))
                };
            }
        }
        var data = cluster.resources[type];
        var target;
        if(action == 'store' || job.args.action == 'offload'){
            target = job.target;
        }else if(action == 'terminal'){
            target = _.first(Util.sort.closest(creep, data.storage));
        }else if(action == 'deliver'){
            target = _.first(Util.sort.closest(creep, data.sources));
        }
        if(target && target.getResource(type) > 0){
            creep.memory.transferPickup = target.id;
            return {
                target,
                amount: Math.min(target.getResource(type), Math.max(0, job.args.amount - job.target.getResource(type)))
            };
        }
        //DEBUG
        console.log('could not generate pickup target', creep, job.id, action, type);
        return false;
    }
    
    getDeliver(cluster, creep, job, resources, action){
        let type = job.args.resource;
        var deliverAmount = this.getDeliverAmount(job, resources);
        if(creep.memory.transferDeliver){
            var target = Game.getObjectById(creep.memory.transferDeliver);
            if(target){
                return {
                    target,
                    amount: deliverAmount
                };
            }
        }
        var target;
        if(job.args.action == 'offload'){
            target = Util.closest(creep, cluster.tagged.onload);
        }else if(action == 'store'){
            var terminalIdeal = 5000 * _.size(cluster.structures.terminal);
            if(type != RESOURCE_ENERGY && cluster.resources[type].totals.terminal + resources <= terminalIdeal + 10000){
                target = _.first(Util.sort.closest(creep, cluster.structures.terminal));
            }else{
                target = _.first(Util.sort.closest(creep, cluster.structures.storage));
            }
        }else if(action == 'terminal'){
            target = _.first(Util.sort.closest(creep, cluster.structures.terminal));
        }else{
            target = job.target;
        }
        if(target){
            creep.memory.transferDeliver = target.id;
            return {
                target,
                amount: deliverAmount
            };
        }
        //DEBUG
        console.log('could not generate delivery target', creep, job.id, resources);
        return false;
    }

    getDeliverAmount(job, resources){
        if(job.args.action == 'store'){
            return resources;
        }
        return Math.min(resources, Math.max(0, job.args.amount - job.target.getResource(job.args.resource)));
    }

}

module.exports = TransferWorker;