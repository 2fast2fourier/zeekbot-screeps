"use strict";

var BaseJob = require('./base');

class UpgradeJob extends BaseJob {
    constructor(catalog){ super(catalog, 'upgrade'); }
    
    calculateCapacity(room, target){
        return Memory.settings.upgradeCapacity || 10;
    }

    generateTargets(room){
        return [room.controller];
    }
}

module.exports = UpgradeJob;