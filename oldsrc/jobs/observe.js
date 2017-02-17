"use strict";

var BaseJob = require('./base');

class ObserveJob extends BaseJob {
    constructor(catalog){ super(catalog, 'observe', { flagPrefix: 'Observe' }); }

    generateJobsForFlag(flag){
        var subflag = this.getSubflag(flag);
        if(!flag.room){
            this.catalog.requestWatch(flag.pos.roomName);
        }
        return [{
            allocated: 0,
            capacity: subflag ? 5 : 1,
            id: this.type+"-"+flag.name,
            target: flag,
            subtype: subflag
        }];
    }
}

module.exports = ObserveJob;