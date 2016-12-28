"use strict";

var BaseJob = require('./base');

class ObserveJob extends BaseJob {
    constructor(catalog){ super(catalog, 'observe', { flagPrefix: 'Observe' }); }

    generateJobsForFlag(flag){
        return [{
            allocated: 0,
            capacity: 5,
            id: this.type+"-"+flag.name,
            target: flag
        }];
    }
}

module.exports = ObserveJob;