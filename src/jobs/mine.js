"use strict";

var BaseJob = require('./base');

class MineJob extends BaseJob {
    constructor(catalog){ super(catalog, 'mine'); }

    generateJobs(room){
        return _.map(room.find(FIND_SOURCES), source => {
            return {
                allocated: 0,
                capacity: Math.floor(source.energyCapacity/600)+1,
                id: this.generateId(source),
                target: source
            }
        });
    }
}

module.exports = MineJob;

