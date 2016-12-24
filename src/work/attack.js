"use strict";

var BaseWorker = require('./base');

class AttackWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'attack', { chatty: true, moveOpts: { ignoreDestructibleStructures: true, reusePath: 2 } }); }

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
        if(distance > 10){
            return false;
        }
        return distance / this.distanceWeight;
    }

    processStep(creep, job, target, opts){
        if(opts.ranged){
            if(creep.pos.getRangeTo(target) > 3){
                this.move(creep, target);
            }else{
                creep.rangedAttack(target);
            }
        }else{
            if(creep.getActiveBodyparts(RANGED_ATTACK) > 0 && creep.pos.getRangeTo(target) <= 3){
                creep.rangedAttack(target);
            }
            return this.orMove(creep, target, creep.attack(target)) == OK;
        }
    }

}

module.exports = AttackWorker;