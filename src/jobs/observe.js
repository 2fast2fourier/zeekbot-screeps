"use strict";

var BaseJob = require('./base');

class ObserveJob extends BaseJob {
    constructor(catalog){ super(catalog, 'observe'); }

    generateJobs(room){
        var flags = this.catalog.getFlagsByPrefix("Observe");
        return _.map(flags, flag => {
            return {
                allocated: 0,
                capacity: 1,
                id: this.type+"-"+flag.name,
                target: flag
            }
        });
    }
}

module.exports = ObserveJob;