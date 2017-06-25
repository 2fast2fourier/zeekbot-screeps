"use strict";

var BaseAction = require('./base');
var Util = require('../util');

var range = 5;

class DefendAction extends BaseAction {
    constructor(){
        super('defend');
    }

    shouldBlock(cluster, creep, opts){
        // var hostiles = cluster.find(creep.room, FIND_HOSTILE_CREEPS);
        // if(hostiles.length > 0){
        //     var targets = _.filter(hostiles, hostile => creep.pos.getRangeTo(hostile) < range && (hostile.getActiveBodyparts(ATTACK) > 0 || hostile.getActiveBodyparts(RANGED_ATTACK) > 0))
        //     var target = _.first(Util.sort.closest(creep, targets));
        //     if(target){
        //         return { type: this.type, data: target };
        //     }
        // }
        return false;
    }

    blocked(cluster, creep, opts, block){
        this.orAttackMove(creep, block, creep.attack(block));
        if(creep.pos.getRangeTo(block) <= 3 && creep.getActiveBodyparts(RANGED_ATTACK) > 0){
            creep.rangedAttack(block);
        }
    }

}


module.exports = DefendAction;