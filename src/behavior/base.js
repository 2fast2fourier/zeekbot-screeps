"use strict";

var Pathing = require('../pathing');

class BaseAction {
    constructor(type){
        this.type = type;
    }

    preWork(cluster, creep, opts){}

    shouldBlock(cluster, creep, opts){
        return false;
    }

    postWork(cluster, creep, opts, action){}

    blocked(cluster, creep, opts, block){
        console.log('block not implemented!', this);
    }

    move(creep, target){
        return Pathing.moveCreep(creep, target, 1, false);
    }

    moveAway(creep, targets, range){
        return Pathing.moveAway(creep, _.isArray(targets) ? targets : [targets], { range, debug: true });
    }

    orMove(creep, target, result){
        if(result == ERR_NOT_IN_RANGE){
            this.move(creep, target);
        }
        return result;
    }

    attackMove(creep, target){
        return Pathing.attackMove(creep, target, 1, false);
    }

    orAttackMove(creep, target, result){
        if(result == ERR_NOT_IN_RANGE){
            this.attackMove(creep, target);
        }
        return result;
    }

}

module.exports = BaseAction;