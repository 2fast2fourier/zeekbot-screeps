"use strict";

var BaseWorker = require('./base');

class AttackWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'attack', { chatty: true }); }

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
        return distance / this.distanceWeight;
    }

    processStep(creep, job, target, opts){
        if(opts.ranged){
            if(creep.pos.getRangeTo(target) > 3){
                creep.moveTo(target);
            }else{
                creep.rangedAttack(target);
            }
        }else if(creep.attack(target) == ERR_NOT_IN_RANGE){
            creep.moveTo(target);
        }
    }

}

module.exports = AttackWorker;