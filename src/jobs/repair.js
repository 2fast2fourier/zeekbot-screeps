"use strict";

var BaseJob = require('./base');

class RepairJob extends BaseJob {
    constructor(catalog){ super(catalog, 'repair', { flagPrefix: 'Repair' }); }

    calculateCapacity(room, target){
        return Math.min(Math.ceil(Math.max(0, Math.min(target.hitsMax, Memory.settings.repairTarget) - target.hits)/100), 10);
    }

    generateTargets(room){
        return _.filter(this.catalog.getStructures(room), structure => structure.hits < Math.min(structure.hitsMax, Memory.settings.repairTarget));
    }
}

module.exports = RepairJob;