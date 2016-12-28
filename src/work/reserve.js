"use strict";

var BaseWorker = require('./base');

class ReserveWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'reserve'); }

    calculateAllocation(creep, opts){
        return creep.getActiveBodyparts(CLAIM);
    }

    calculateBid(creep, opts, job, allocation, distance){
        if(!!opts.downgrade != job.downgrade){
            return false;
        }
        return distance/this.distanceWeight;
    }

    processStep(creep, job, target, opts){
        if(target.name){
            this.move(creep, target);
        }else if(opts.downgrade){
            this.orMove(creep, target, creep.attackController(target));
        }else if(creep.memory.claim && creep.claimController(target) == OK){
            creep.memory.claim = false;
        }else if(creep.reserveController(target) == ERR_NOT_IN_RANGE){
            this.move(creep, target);
        }
    }

}

module.exports = ReserveWorker;