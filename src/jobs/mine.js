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

    generateTargets(room, flag){
        var targets = room.find(FIND_SOURCES);
        var roomStats = Memory.stats.rooms[room.name];
        if(roomStats && roomStats.extractor && roomStats.mineralAmount > 0){
            var mineral = Game.getObjectById(roomStats.mineralId);
            if(mineral && mineral.mineralAmount > 0){
                targets.push(mineral);
            }
        }
        // var hostiles = this.catalog.getHostileCreeps(room);
        // targets = _.filter(targets, target => _.size(_.filter(hostiles, hostile => target.pos.getRangeTo(hostile) <= 10)) == 0);
        if(flag && Memory.settings.flagRange[this.type] > 0){
            return _.filter(targets, target => flag.pos.getRangeTo(target) <= Memory.settings.flagRange[this.type]);
        }
        return targets;
    }
}

module.exports = MineJob;

