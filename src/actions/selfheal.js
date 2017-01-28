"use strict";

var BaseAction = require('./base');

class SelfHealAction extends BaseAction {
    constructor(catalog){
        super(catalog, 'selfheal');
    }

    shouldBlock(creep, opts){
        return opts.block && creep.hits < creep.hitsMax - 200;
    }

    postWork(creep, opts, action){
        if(!action && creep.hits < creep.hitsMax){
            creep.heal(creep);
        }
    }

    blocked(creep, opts, block){
        if(creep.hits < creep.hitsMax){
            creep.heal(creep);
        }
    }

}


module.exports = SelfHealAction;