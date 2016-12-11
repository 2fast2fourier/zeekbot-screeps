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
        if(this.getJobDistance(creep, job) > 1){
            creep.moveTo(target);
        }
    }

}

module.exports = ObserveWorker;