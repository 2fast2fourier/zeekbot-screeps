"use strict";

var SimpleWorker = require('./simple');

class DropWorker extends SimpleWorker {
    constructor(catalog){ super(catalog, 'drop', { requiresEnergy: true }); }

    stillValid(creep, opts){
        return this.catalog.getStorage(creep) > 0;
    }

    bid(creep, opts){
        if(this.catalog.getStorage(creep) == 0){
            return false;
        }
        var bid = this.getResourceOffset(creep, opts.type || RESOURCE_ENERGY) + _.get(opts, 'priority', 0);
        return { bid, type: this.type };
    }

    process(creep, opts){
        _.forEach(creep.carry, (amount, type)=>{
            if(amount > 0){
                creep.drop(type, amount);
            }
        });
    }

}

module.exports = DropWorker;