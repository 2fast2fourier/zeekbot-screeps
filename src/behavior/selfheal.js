"use strict";

var BaseAction = require('./base');

class SelfHealAction extends BaseAction {
    constructor(){
        super('selfheal');
    }

    shouldBlock(cluster, creep, opts){
        if(opts.auto){
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