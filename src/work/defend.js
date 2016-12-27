"use strict";

var BaseWorker = require('./base');

class DefendWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'defend', { flagPrefix: 'Defend', chatty: true, moveOpts: { ignoreDestructibleStructures: true, reusePath: 3 } }); }

    calculateAllocation(creep, opts){
        return creep.getActiveBodyparts(ATTACK) + creep.getActiveBodyparts(RANGED_ATTACK);
    }

    isValid(){
        return false;
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
                this.move(creep, target);
            }else{
                creep.rangedAttack(target);
            }
            if(creep.pos.getRangeTo(target) < 3){
                creep.move((creep.pos.getDirectionTo(target)+4)%8);
            }
        }else{
            if(creep.getActiveBodyparts(RANGED_ATTACK) > 0 && creep.pos.getRangeTo(target) <= 3){
                creep.rangedAttack(target);
            }
            return this.orMove(creep, target, creep.attack(target)) == OK;
        }
    }

}

module.exports = DefendWorker;