"use strict";

var StaticWorker = require('./static');
var Util = require('../util');

class TransferWorker extends StaticWorker {
    constructor(catalog){ super(catalog, 'transfer', { chatty: true, multipart: ['subtype', 'resource', 'amount', 'id'] }); }

    validate(creep, opts, target, job){
        var resources = Util.getResource(creep, job.resource);
        var targetResources = Util.getResource(job.target, job.resource);
        var data = this.catalog.resources[job.resource];
        var allStored = data.total;
        var stored = data.totals.storage;
        var terminalStored = data.totals.terminal;
        if(job.subtype == 'store'){
            if(resources > 0){
                return true;
            }else{
                return targetResources > job.amount;
            }
        }else if(job.subtype == 'deliver'){
            if(resources > 0){
                return targetResources < job.amount;
            }else{
                return targetResources < job.amount && allStored > 0;
            }
        }else if(job.subtype == 'terminal'){
            if(resources > 0){
                return terminalStored < job.amount;
            }else{
                return terminalStored < job.amount && stored > 0;
            }
        }
        console.log('invalid type', job.id, creep, job.subtype);
        return false;
    }

    isValid(creep, opts, target, job){
        var valid = this.validate(creep, opts, target, job);
        if(valid && Util.getResource(creep, job.resource) == 0 && !this.jobExists(job.id)){
            return false;
        }
        return valid;
    }

    canBid(creep, opts, target, job){
        if(creep.ticksToLive < 100){
            return false;
        }
        var resources = Util.getResource(creep, job.resource);
        if(Util.getStorage(creep) > 0 && resources == 0){
            return false;
        }
        return this.validate(creep, opts, target, job);
    }

    processStep(creep, target, opts, job){
        var deliver = false;
        var pickup = false;
        var resources = Util.getResource(creep, job.resource);
        if(resources > 0){
            creep.memory.transferPickup = false;
            deliver = this.getDeliver(creep, job, resources);
        }else{
            creep.memory.transferDeliver = false;
            pickup = this.getPickup(creep, job);
        }
        if(deliver){
            this.orMove(creep, deliver.target, creep.transfer(deliver.target, job.resource, deliver.amount));
        }else if(pickup){
            this.orMove(creep, pickup.target, creep.withdraw(pickup.target, job.resource, Math.min(Util.getCapacity(creep) - Util.getStorage(creep), pickup.amount)));
        }
    }

    getTargetNeed(job){
        var targetResources = Util.getResource(job.target, job.resource);
        return Math.max(0, job.amount - targetResources);
    }

    getDeliverAmount(job, resources){
        if(job.subtype == 'store'){
            return resources;
        }
        return Math.min(resources, this.getTargetNeed(job));
    }

    getDeliver(creep, job, resources){
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
        if(job.subtype == 'store'){
            var terminalIdeal = Memory.settings.terminalIdealResources * _.size(this.catalog.buildings.terminal);
            if(this.catalog.resources[job.resource].totals.terminal + resources <= terminalIdeal + 10000){
                target = _.first(Util.helper.closestNotFull(creep, this.catalog.buildings.terminal));
            }else{
                target = _.first(Util.helper.closestNotFull(creep, this.catalog.buildings.storage));
            }
        }else if(job.subtype == 'terminal'){
            target = _.first(Util.helper.closestNotFull(creep, this.catalog.buildings.terminal));
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

    getPickup(creep, job){
        if(creep.memory.transferPickup){
            var target = Game.getObjectById(creep.memory.transferPickup);
            var targetResources = Util.getResource(target, job.resource);
            if(target && targetResources > 0){
                return {
                    target,
                    amount: Math.min(targetResources, this.getTargetNeed(job))
                };
            }
        }
        var data = this.catalog.resources[job.resource];
        var target;
        if(job.subtype == 'store'){
            target = job.target;
        }else if(job.subtype == 'terminal'){
            target = _.first(Util.sort.closest(creep, data.storage));
        }else if(job.subtype == 'deliver'){
            target = _.first(Util.sort.closest(creep, data.sources));
        }
        var targetResources = Util.getResource(target, job.resource);
        if(target && targetResources > 0){
            creep.memory.transferPickup = target.id;
            return {
                target,
                amount: Math.min(targetResources, this.getTargetNeed(job))
            };
        }
        //DEBUG
        console.log('could not generate pickup target', creep, job.id, resources);
        return false;
    }

    start(creep, bid, opts){
        super.start(creep, bid, opts);
        creep.memory.transferPickup = false;
        creep.memory.transferDeliver = false;
    }

    stop(creep, opts){
        super.stop(creep, opts);
        if(creep.memory.transferPickup){
            delete creep.memory.transferPickup;
        }
        if(creep.memory.transferDeliver){
            delete creep.memory.transferDeliver;
        }
    }

}

module.exports = TransferWorker;