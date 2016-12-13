"use strict";

var BaseJob = require('./base');

class MineJob extends BaseJob {
    constructor(catalog){ super(catalog, 'mine', { flagPrefix: 'Mine' }); }

    calculateCapacity(room, target){
        if(target.mineralAmount > 0){
            return 5;
        }
        return Math.floor(target.energyCapacity/600)+1;
    }

    generateTargets(room){
        var targets = room.find(FIND_SOURCES);
        var roomStats = Memory.stats.rooms[room.name];
        if(roomStats && roomStats.extractor && roomStats.mineralAmount > 0){
            var mineral = Game.getObjectById(roomStats.mineralId);
            if(mineral && mineral.mineralAmount > 0){
                targets.push(mineral);
            }
        }
        return targets;
    }
}

module.exports = MineJob;

