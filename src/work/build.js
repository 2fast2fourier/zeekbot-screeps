"use strict";

var BaseWorker = require('./base');

class BuildWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'build', { requiresEnergy: true, chatty: true }); }

    calculateAllocation(creep, opts){
        if(creep.getActiveBodyparts(WORK) > 0){
            return this.catalog.getResource(creep, RESOURCE_ENERGY)/5;
        }
        return 0;
    }

    calculateBid(creep, opts, job, allocation, distance){
        return this.getEnergyOffset(creep) + distance / this.distanceWeight;
    }

    processStep(creep, job, target, opts){
        var result = creep.build(target);
        if(result == ERR_NOT_IN_RANGE){
            creep.moveTo(target);
        }else if(result == ERR_INVALID_TARGET){
            creep.move(Math.ceil(Math.random()*8));
        }
    }

}

module.exports = BuildWorker;