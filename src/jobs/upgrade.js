"use strict";

var BaseJob = require('./base');

class UpgradeJob extends BaseJob {
    constructor(catalog){ super(catalog, 'upgrade', { flagPrefix: 'Upgrade' }); }
    
    calculateCapacity(room, target, flag){
        var capacity = Memory.settings.upgradeCapacity || 10;
        if(flag){
            var flagparts = flag.name.split('-');
            if(flagparts.length > 2){
                return _.parseInt(flagparts[1]);
            }else{
                return capacity * 2;
            }
        }
        return capacity;
    }

    generateTargets(room, flag){
        return [room.controller];
    }
}

module.exports = UpgradeJob;