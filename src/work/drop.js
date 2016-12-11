"use strict";

var SimpleWorker = require('./simple');

class DropWorker extends SimpleWorker {
    constructor(catalog){ super(catalog, 'drop', { requiresEnergy: true }); }

    stillValid(creep, opts){
        return this.catalog.getResource(creep, opts.type || RESOURCE_ENERGY) > 0;
    }

    bid(creep, opts){
        if(this.catalog.getResource(creep, RESOURCE_ENERGY) == 0){
            return false;
        }
        var bid = this.getResourceOffset(creep, opts.type || RESOURCE_ENERGY) + _.get(opts, 'priority', 0);
        return { bid, type: this.type };
    }

    process(creep, opts){
        creep.drop(opts.type || RESOURCE_ENERGY, this.catalog.getResource(creep, opts.type || RESOURCE_ENERGY));
    }

}

module.exports = DropWorker;