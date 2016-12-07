"use strict";

var RoomUtil = require('../roomutil');
var { RemoteBaseBehavior } = require('./base');

class MiningBehavior extends RemoteBaseBehavior {
    constructor(){ super('mining'); }

    stillValid(creep, data, catalog){
        if(super.stillValid(creep, data, catalog)){
            return true;
        }
        return creep.carry.energy < creep.carryCapacity - 10 && this.exists(creep);
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
            this.setTrait(creep, creep.memory.lastSource);
        }else if(data.maxRange > 0){
            this.setTrait(creep, _.get(RoomUtil.getNearestSource(creep, data.maxRange), 'id', null));
        }else{
            this.setTrait(creep, RoomUtil.findFreeMiningId(creep.room, creep, catalog));
        }
        
        return this.exists(creep);
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