"use strict";

var BaseWorker = require('./base');

class HealWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'heal', { chatty: true }); }

    calculateAllocation(creep, opts){
        return Math.min(creep.getActiveBodyparts(HEAL), 1);
    }

    calculateBid(creep, opts, job, allocation, distance){
        return distance / this.distanceWeight + job.allocated;
    }

    processStep(creep, job, target, opts){
        var range = creep.pos.getRangeTo(target);
        if(range > 1 && range <= 3){
            creep.rangedHeal(target);
            creep.moveTo(target);
        }else if(creep.heal(target) == ERR_NOT_IN_RANGE){
            creep.moveTo(target);
        }
    }

}

module.exports = HealWorker;