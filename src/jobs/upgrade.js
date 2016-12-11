"use strict";

var BaseJob = require('./base');

class UpgradeJob extends BaseJob {
    constructor(catalog){ super(catalog, 'upgrade'); }

    generateJobs(room){
        return [{
            allocated: 0,
            capacity: Memory.settings.upgradeCapacity || 200,
            id: this.generateId(room.controller),
            target: room.controller
        }];
    }
}

module.exports = UpgradeJob;