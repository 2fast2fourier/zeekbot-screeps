"use strict";

var BaseWorker = require('./base');

class DefendWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'defend', { flagPrefix: 'Defend', chatty: true }); }

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
        if(job.keeper && distance > 10){
            return false;
        }
        return distance / this.distanceWeight;
    }

    processStep(creep, job, target, opts){
        if(opts.ranged){
            if(creep.pos.getRangeTo(target) > 3){
                creep.moveTo(target);
            }else{
                creep.rangedAttack(target);
            }
            if(creep.pos.getRangeTo(target) < 3){
                creep.move((creep.pos.getDirectionTo(target)+4)%8);
            }
        }else{
            if(creep.attack(target) == ERR_NOT_IN_RANGE){
                creep.moveTo(target);
            }
            if(creep.getActiveBodyparts(RANGED_ATTACK) > 0 && creep.pos.getRangeTo(target) <= 3){
                creep.rangedAttack(target);
            }
        }
    }

}

module.exports = DefendWorker;