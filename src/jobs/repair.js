"use strict";

var BaseJob = require('./base');

class RepairJob extends BaseJob {
    constructor(catalog){ super(catalog, 'repair'); }

    generateJobs(room){
        return _.map(_.filter(this.catalog.getStructures(room), structure => structure.hits < Math.min(structure.hitsMax, Memory.settings.repairTarget)), structure => {
            return {
                allocated: 0,
                capacity: Math.min(Math.ceil(Math.max(0, Math.min(structure.hitsMax, Memory.settings.repairTarget) - structure.hits)/100), 10),
                id: this.generateId(structure),
                target: structure
            }
        });
    }
}

module.exports = RepairJob;