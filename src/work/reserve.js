"use strict";

var BaseWorker = require('./base');

class ReserveWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'reserve'); }

    calculateAllocation(creep, opts){
        return creep.getActiveBodyparts(CLAIM);
    }

    calculateBid(creep, opts, job, allocation, distance){
        return distance/this.distanceWeight;
    }

    processStep(creep, job, target, opts){
        if(target.name){
            creep.moveTo(target);
        }else if(creep.memory.claim && creep.claimController(target) == OK){
            creep.memory.claim = false;
        }else if(creep.reserveController(target) == ERR_NOT_IN_RANGE){
            creep.moveTo(target);
        }
    }

}

module.exports = ReserveWorker;