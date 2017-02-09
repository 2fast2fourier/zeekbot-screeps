"use strict";

var BaseJob = require('./base');

class UpgradeJob extends BaseJob {
    constructor(catalog){ super(catalog, 'upgrade'); }
    
    calculateCapacity(room, target, flag){
        var baseCapacity = Memory.settings.upgradeCapacity || 10;
        var capacity = baseCapacity;
        var rcl = target.level;
        if(rcl <= 6){
            capacity += baseCapacity;
        }
        if(rcl <= 7 && Memory.stats.global.totalEnergy > 200000 * this.catalog.rooms.length){
            capacity += baseCapacity;
        }
        return capacity;
    }

    generateTargets(){
        return _.map(this.catalog.rooms, 'controller');
    }
}

module.exports = UpgradeJob;