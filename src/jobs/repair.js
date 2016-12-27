"use strict";

var StaticJob = require('./static');

class RepairJob extends StaticJob {
    constructor(catalog){ super(catalog, 'repair', { flagPrefix: 'Repair', refresh: 20 }); }

    generateTargets(room){
        return _.filter(this.catalog.getStructures(room), structure => structure.hits < Math.min(structure.hitsMax, Memory.settings.repairTarget));
    }

    finalizeTargetList(targets){
        var sorted = _.sortBy(targets, structure => structure.hits / Math.min(structure.hitsMax, Memory.settings.repairTarget));
        if(sorted.length < 20){
            return sorted;
        }
        return _.slice(sorted, 0, 20);
    }

}

module.exports = RepairJob;