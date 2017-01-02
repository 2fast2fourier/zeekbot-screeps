"use strict";

var BaseWorker = require('./base');

class KeepWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'keep'); }

    isValid(creep, opts, job, target){
        return job.capacity >= job.allocated && _.get(Memory.stats.rooms, [target.pos.roomName, 'hostileCount'], 0) == 0;
    }

    calculateAllocation(creep, opts){
        if(creep.memory.boosted && creep.memory.boosted.XUH2O > 0){
            return this.calculateBoostedTotal(creep, 'attack', 'XUH2O', 'attack')  + creep.getActiveBodyparts(RANGED_ATTACK);
        }
        return creep.getActiveBodyparts(ATTACK) + creep.getActiveBodyparts(RANGED_ATTACK);
    }

    canBid(creep, opts){
        if(creep.hits < creep.hitsMax / 1.25){
            return false;
        }
        return true;
    }

    calculateBid(creep, opts, job, allocation, distance){
        if(job.target.ticksToSpawn > creep.ticksToLive){
            return false;
        }
        return 99 + distance / this.distanceWeight + job.priority;
    }

    processStep(creep, job, target, opts){
        if(creep.ticksToLive < 100){
            creep.memory.jobAllocation = 10;
        }
        var pos = creep.pos;
        var range = 10;
        var targetRange = target.ticksToSpawn > 50 ? 2 : 1;
        var hostiles = _.map(_.filter(creep.room.lookForAtArea(LOOK_CREEPS, pos.y - range, pos.x - range, pos.y + range, pos.x + range, true), target => !target.creep.my), 'creep');
        if(hostiles.length > 0){
            var enemy = _.first(_.sortBy(hostiles, hostile => creep.pos.getRangeTo(hostile)));
            return this.orMove(creep, enemy, creep.attack(enemy)) == OK;
        }else if(creep.pos.getRangeTo(target) > targetRange){
            this.move(creep, target);
        }else if(creep.pos.getRangeTo(target) < targetRange){
            creep.move((creep.pos.getDirectionTo(target)+4)%8);
        }
    }

}

module.exports = KeepWorker;