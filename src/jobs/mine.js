"use strict";

var BaseJob = require('./base');

class MineJob extends BaseJob {
    constructor(catalog){ super(catalog, 'mine', { flagPrefix: 'Mine' }); }

    calculateCapacity(room, target){
        if(target.mineralAmount > 0){
            return 5;
        }
        //right now a mix of 6 and 7 capacity spawns means we underestimate the number of miners.
        //so use 7 regardless of actual need
        return 7;//Math.floor(target.energyCapacity/600)+1;
    }

    generateTargets(room, flag){
        //TODO check ownership/reservation
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

    generateJobForTarget(room, target, flag){
        var job = super.generateJobForTarget(room, target, flag);
        if(job.target.mineralAmount > 0){
            job.subtype = 'mineral';
        }else{
            job.subtype = 'energy';
        }
        return job;
    }
}

module.exports = MineJob;

