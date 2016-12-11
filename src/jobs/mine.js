"use strict";

var BaseJob = require('./base');

class MineJob extends BaseJob {
    constructor(catalog){ super(catalog, 'mine', { flagPrefix: 'Mine' }); }

    generateJobs(room){
        return _.map(room.find(FIND_SOURCES), source => this.generateSource(source));
    }

    generateJobsForFlag(flag){
        if(!flag.room){
            return [];
        }
        return _.map(flag.room.find(FIND_SOURCES), source => this.generateSource(source));
    }

    generateSource(source){
        return {
            allocated: 0,
            capacity: Math.floor(source.energyCapacity/600)+1,
            id: this.generateId(source),
            target: source
        }
    }
}

module.exports = MineJob;

