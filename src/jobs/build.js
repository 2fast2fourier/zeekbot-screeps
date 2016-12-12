"use strict";

var BaseJob = require('./base');

class BuildJob extends BaseJob {
    constructor(catalog){ super(catalog, 'build', { flagPrefix: 'Build' }); }

    generateJobs(room){
        return _.map(room.find(FIND_MY_CONSTRUCTION_SITES), site => {
            return {
                allocated: 0,
                capacity: Math.min(Math.ceil((site.progressTotal - site.progress)/5), 40),
                id: this.generateId(site),
                target: site
            }
        });
    }

    generateJobsForFlag(flag){
        if(!flag.room){
            return [];
        }
        return this.generateJobs(flag.room);
    }
}

module.exports = BuildJob;