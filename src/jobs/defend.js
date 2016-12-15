"use strict";

var BaseJob = require('./base');

class DefendJob extends BaseJob {
    constructor(catalog){ super(catalog, 'defend', { flagPrefix: 'Defend' }); }

    calculateCapacity(room, target){
        return 50;
    }

    generateTargets(room){
        return _.filter(this.catalog.getHostileCreeps(room), creep => _.get(creep, 'owner.username', false) != 'Source Keeper');
    }
}

module.exports = DefendJob;

