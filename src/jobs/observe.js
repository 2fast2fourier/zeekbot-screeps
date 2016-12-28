"use strict";

var BaseJob = require('./base');

class ObserveJob extends BaseJob {
    constructor(catalog){ super(catalog, 'observe', { flagPrefix: 'Observe' }); }

    generateJobsForFlag(flag){
        var flagparts = flag.name.split('-');
        var subflag = false;
        if(flagparts.length > 2){
            subflag = flagparts[1];
        }
        return [{
            allocated: 0,
            capacity: subflag ? 5 : 2,
            id: this.type+"-"+flag.name,
            target: flag,
            subflag
        }];
    }
}

module.exports = ObserveJob;