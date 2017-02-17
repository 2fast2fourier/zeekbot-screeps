"use strict";

var BaseWorker = require('./base');

class IdleWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'idle', { idleTimer: 10 }); }

    calculateAllocation(creep, opts){
        return 1;
    }

    calculateBid(creep, opts, job, allocation, distance){
        if(opts.type && job.idleType !== opts.type){
            return false;
        }
        return 999+distance/this.distanceWeight;
    }

    processStep(creep, job, target, opts){
        if(creep.pos.getRangeTo(target) > 3){
            this.move(creep, target);
        }
    }

}

module.exports = IdleWorker;