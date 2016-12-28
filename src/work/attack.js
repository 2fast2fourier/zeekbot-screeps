"use strict";

var BaseWorker = require('./base');

class AttackWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'attack', { chatty: true, moveOpts: { ignoreDestructibleStructures: true, reusePath: 4 } }); }

    calculateAllocation(creep, opts){
        return creep.getActiveBodyparts(ATTACK) + creep.getActiveBodyparts(RANGED_ATTACK);
    }

    canBid(creep, opts){
        if(creep.hits < creep.hitsMax / 1.5){
            return false;
        }
        return true;
    }

    calculateBid(creep, opts, job, allocation, distance){
        return distance / this.distanceWeight - 99;
    }

    processStep(creep, job, target, opts){
        if(!target.room){
            this.move(creep, target);
            return;
        }
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