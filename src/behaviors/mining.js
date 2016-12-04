"use strict";

var RoomUtil = require('../roomutil');
var { RemoteBaseBehavior } = require('./base');

class MiningBehavior extends RemoteBaseBehavior {
    constructor(){ super('mining'); }

    stillValid(creep, data, catalog){
        if(super.stillValid(creep, data, catalog)){
            return true;
        }
        var target = Game.getObjectById(creep.memory.traits.mining);
        if(target && data.maxRange && data.maxRange < creep.pos.getRangeTo(target)){
            return false;
        }
        return creep.carry.energy < creep.carryCapacity - 10 && target;
    }

    bid(creep, data, catalog){
        if(super.bid(creep, data, catalog)){
            return -999;
        }
        if(creep.carry.energy >= creep.carryCapacity){
            return false;
        }
        return creep.carry.energy / creep.carryCapacity + (data.priority || 0);
    }

    start(creep, data, catalog){
        if(super.start(creep, data, catalog)){
            return true;
        }
        if(creep.memory.lastSource && RoomUtil.exists(creep.memory.lastSource)){
            creep.memory.traits.mining = creep.memory.lastSource;
        }else{
            creep.memory.traits.mining = RoomUtil.findFreeMiningId(creep.room, creep, catalog);
        }
        
        return RoomUtil.exists(creep.memory.traits.mining);
    }

    process(creep, data, catalog){
        if(super.process(creep, data, catalog)){
            return;
        }
        var source = this.target(creep);
        if(source && creep.harvest(source) == ERR_NOT_IN_RANGE) {
            creep.moveTo(source);
        }
    }

    end(creep, data, catalog){
        creep.memory.lastSource = this.trait(creep);
        super.end(creep, data, catalog);
    }
};

module.exports = MiningBehavior;