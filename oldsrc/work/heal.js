"use strict";

var BaseWorker = require('./base');

class HealWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'heal', { chatty: true, simpleMove: true }); }

    calculateAllocation(creep, opts){
        return Math.min(creep.getActiveBodyparts(HEAL), 1);
    }

    calculateBid(creep, opts, job, allocation, distance){
        return distance / this.distanceWeight + job.allocated + (0.25 - creep.ticksToLive/6000);
    }

    processStep(creep, job, target, opts){
        var range = creep.pos.getRangeTo(target);
        if(range > 1 && range <= 3){
            creep.rangedHeal(target);
            this.move(creep, target);
        }else{
            this.orMove(creep, target, creep.heal(target));
        }
    }

}

module.exports = HealWorker;