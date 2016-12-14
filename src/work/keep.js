"use strict";

var BaseWorker = require('./base');

class KeepWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'keep'); }


    isValid(creep, opts, job, target){
        return creep.pos.getRangeTo(target) > 3;
    }

    calculateAllocation(creep, opts){
        return creep.getActiveBodyparts(ATTACK) + creep.getActiveBodyparts(RANGED_ATTACK);
    }

    canBid(creep, opts){
        if(creep.hits < creep.hitsMax / 2){
            return false;
        }
        return true;
    }

    calculateBid(creep, opts, job, allocation, distance){
        return 99 + distance / this.distanceWeight;
    }

    processStep(creep, job, target, opts){
        if(creep.pos.getRangeTo(target) > 1){
            creep.moveTo(target);
        }
    }

}

module.exports = KeepWorker;