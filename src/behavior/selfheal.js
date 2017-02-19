"use strict";

var BaseAction = require('./base');

class SelfHealAction extends BaseAction {
    constructor(){
        super('selfheal');
    }

    shouldBlock(cluster, creep, opts){
        return opts.block && creep.hits < creep.hitsMax - 200;
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