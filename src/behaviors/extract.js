"use strict";

var RoomUtil = require('../roomutil');
var { RemoteBaseBehavior } = require('./base');

class ExtractBehavior extends RemoteBaseBehavior {
    constructor(){ super('extract'); }

    stillValid(creep, data, catalog){
        if(super.stillValid(creep, data, catalog)){
            return true;
        }
        return _.sum(creep.carry) < creep.carryCapacity && this.exists(creep) && RoomUtil.getStat(creep.room, 'extractor', false);
    }

    bid(creep, data, catalog){
        if(super.bid(creep, data, catalog)){
            return -999;
        }
        var minerals = creep.room.find(FIND_MINERALS);
        if(!RoomUtil.getStat(creep.room, 'extractor', false) || _.sum(creep.carry) >= creep.carryCapacity || minerals.length == 0){
            return false;
        }
        return _.sum(creep.carry) / creep.carryCapacity + (data.priority || 0);
    }

    start(creep, data, catalog){
        if(super.start(creep, data, catalog)){
            return true;
        }

        var minerals = creep.room.find(FIND_MINERALS);

        this.setTrait(creep, _.get(minerals, '[0].id'));
        
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
};

module.exports = ExtractBehavior;