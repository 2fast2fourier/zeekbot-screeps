"use strict";

var BaseWorker = require('./base');

class KeepWorker extends BaseWorker {
    constructor(catalog){ super(catalog, 'keep'); }

    isValid(creep, opts, job, target){
        return job.capacity >= job.allocated && _.get(Memory.stats.rooms, [target.pos.roomName, 'hostileCount'], 0) == 0;
    }

    calculateAllocation(creep, opts){
        return creep.getActiveBodyparts(ATTACK) + creep.getActiveBodyparts(RANGED_ATTACK);
    }

    canBid(creep, opts){
        if(creep.hits < creep.hitsMax / 1.1){
            return false;
        }
        return true;
    }

    calculateBid(creep, opts, job, allocation, distance){
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
            if(creep.attack(enemy) == ERR_NOT_IN_RANGE){
                creep.moveTo(enemy);
            }
        }else if(creep.pos.getRangeTo(target) > targetRange){
            creep.moveTo(target);
        }else if(creep.pos.getRangeTo(target) < targetRange){
            creep.move((creep.pos.getDirectionTo(target)+4)%8);
        }
    }

}

module.exports = KeepWorker;