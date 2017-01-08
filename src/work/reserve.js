"use strict";

var BaseWorker = require('./base');

class ReserveWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'reserve'); }

    calculateAllocation(creep, opts){
        return creep.getActiveBodyparts(CLAIM);
    }

    calculateBid(creep, opts, job, allocation, distance){
        if(!opts.downgrade && job.downgrade){
            return false;
        }
        return distance/this.distanceWeight;
    }

    processStep(creep, job, target, opts){
        if(target.name){
            this.move(creep, target);
        }else if(job.downgrade && opts.downgrade){
            this.orMove(creep, target, creep.attackController(target));
        }else if(job.claim){
            if(this.orMove(creep, target, creep.claimController(target)) == OK){
                job.flag.remove();
            }
        }else if(creep.reserveController(target) == ERR_NOT_IN_RANGE){
            this.move(creep, target);
        }
    }

}

module.exports = ReserveWorker;