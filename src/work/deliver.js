"use strict";

var BaseWorker = require('./base');

var defaultTypes = [
    STRUCTURE_SPAWN,
    STRUCTURE_EXTENSION,
    STRUCTURE_TOWER
];

var mineralTypes = [
    STRUCTURE_STORAGE,
    STRUCTURE_TERMINAL,
    STRUCTURE_LAB
];

class DeliverWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'deliver'); }

    isValid(creep, opts, job, target){
        return super.isValid(creep, opts, job, target) && this.catalog.getAvailableCapacity(target) > 10 && this.catalog.getStorage(creep) > 0;
    }

    calculateAllocation(creep, opts){
        return this.catalog.getStorage(creep);
    }

    calculateBid(creep, opts, job, allocation, distance){
        if(opts.ignoreCreeps && job.creep){
            return false;
        }
        if(creep.memory.lastSource == job.target.id){
            return false;
        }
        var distanceOffset = opts.ignoreDistance ? 0 : distance / this.distanceWeight;
        if(this.catalog.hasMinerals(creep)){
            if(!job.minerals || !job.target.structureType || !_.includes(opts.mineralTypes || mineralTypes, job.target.structureType)){
                return false;
            }
            return this.getStorageOffset(creep) + distanceOffset + this.catalog.getStoragePercent(job.target)/10 + job.offset;
        }else{
            if(job.target.structureType && !_.includes(opts.types || defaultTypes, job.target.structureType)){
                return false;
            }
            return this.getStorageOffset(creep) + distanceOffset + this.catalog.getResourcePercent(job.target, RESOURCE_ENERGY)/10 + job.offset;
        }
    }

    processStep(creep, job, target, opts){
        var done = false;
        _.forEach(this.catalog.getResourceList(creep), (amount, type) => {
            if(done){
                return;
            }
            var result = creep.transfer(target, type);
            if(result == ERR_NOT_IN_RANGE){
                this.move(creep, target);
                done = true;
            }else if(result == OK){
                done = true;
            }
        });
    }

}

module.exports = DeliverWorker;