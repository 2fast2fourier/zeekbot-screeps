"use strict";

var StaticJob = require('./static');
var Util = require('../util');

class RepairJob extends StaticJob {
    constructor(catalog){ super(catalog, 'repair', { flagPrefix: 'Repair', refresh: 20 }); }

    generateTargets(room){
        return _.filter(this.catalog.getStructures(room), structure => structure.hits < Math.min(structure.hitsMax, Memory.settings.repairTarget) && Util.owned(structure));
    }

    finalizeTargetList(targets){
        var sorted = _.sortBy(targets, structure => structure.hits / Math.min(structure.hitsMax, Memory.settings.repairTarget));
        if(sorted.length < 30){
            return sorted;
        }
        return _.slice(sorted, 0, 30);
    }

}

module.exports = RepairJob;