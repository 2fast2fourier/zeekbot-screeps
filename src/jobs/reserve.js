"use strict";

var BaseJob = require('./base');

class ReserveJob extends BaseJob {
    constructor(catalog){ super(catalog, 'reserve'); }

    generateJobs(room){
        var flags = this.catalog.getFlagsByPrefix("Reserve");
        return _.map(flags, flag => {
            return {
                allocated: 0,
                capacity: 2,
                id: this.type+"-"+flag.name,
                target: _.get(flag.room, 'controller', flag)
            }
        });
    }
}

module.exports = ReserveJob;