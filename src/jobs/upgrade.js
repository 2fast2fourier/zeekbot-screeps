"use strict";

var BaseJob = require('./base');

class UpgradeJob extends BaseJob {
    constructor(catalog){ super(catalog, 'upgrade'); }
    
    calculateCapacity(room, target, flag){
        var baseCapacity = Memory.settings.upgradeCapacity;
        var capacity = baseCapacity;
        var rcl = target.level;
        if(rcl < 7){
            capacity += baseCapacity * Math.min(2, Math.abs(rcl - 7));
        }
        return capacity;
    }

    generateTargets(){
        return _.map(this.catalog.rooms, 'controller');
    }
}

module.exports = UpgradeJob;