"use strict";

var BaseWorker = require('./base');

class ObserveWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'observe', { idleTimer: 50 }); }

    calculateAllocation(creep, opts){
        return 1;
    }

    calculateBid(creep, opts, job, allocation, distance){
        return distance/this.distanceWeight;
    }

    processStep(creep, job, target, opts){
        if(creep.pos.getRangeTo(target) > 1){
            this.move(creep, target);
        }
    }

}

module.exports = ObserveWorker;