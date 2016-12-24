"use strict";

var BaseAction = require('./base');

class SelfHealAction extends BaseAction {
    constructor(catalog){
        super(catalog, 'selfheal');
    }

    postWork(creep, opts, action){
        if(!action && creep.hits < creep.hitsMax){
            creep.heal(creep);
        }
    }
}


module.exports = SelfHealAction;