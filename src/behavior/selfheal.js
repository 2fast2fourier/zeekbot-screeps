"use strict";

var BaseAction = require('./base');
var Util = require('../util');

class SelfHealAction extends BaseAction {
    constructor(){
        super('selfheal');
    }

    shouldBlock(cluster, creep, opts){
        if(opts.auto){
            if(opts.crossheal && creep.hits == creep.hitsMax && creep.room.matrix.damaged.length > 0){
                var closest = Util.closest(creep, creep.room.matrix.damaged);
                if(closest && creep.pos.getRangeTo(closest) == 1){
                    creep.heal(closest);
                    return false;
                }
            }
            if(creep.hits < creep.hitsMax || creep.room.matrix.hostiles.length > 0 || creep.room.hostile){
                creep.heal(creep);
            }
            return false;
        }
        if(opts.block && creep.hits < creep.hitsMax - opts.block){
            return { type: this.type, data: true };
        }
        return false;
    }

    postWork(cluster, creep, opts, action){
        if(!action && creep.hits < creep.hitsMax){
            creep.heal(creep);
        }
    }

    blocked(cluster, creep, opts, block){
        if(creep.hits < creep.hitsMax){
            creep.heal(creep);
        }
    }

}


module.exports = SelfHealAction;