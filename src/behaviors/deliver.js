"use strict";

var RoomUtil = require('../roomutil');
var { RemoteBaseBehavior } = require('./base');


class DeliverBehavior extends RemoteBaseBehavior {
    constructor(){ super('deliver'); };

    stillValid(creep, data, catalog){
        if(creep.carry.energy > 0 && super.stillValid(creep, data, catalog)){
            return true;
        }
        var target = Game.getObjectById(creep.memory.traits.deliver);
        if(data.maxRange && creep.pos.getRangeTo(target) > data.maxRange){
            return false;
        }
        if(creep.carry.energy == 0 || target == null){
            return false;
        }else{
            return RoomUtil.getEnergyPercent(target) < 0.85;
        }
    }

    bid(creep, data, catalog){
        var energy = RoomUtil.getEnergyPercent(creep);
        if(energy > 0.1 && super.bid(creep, data, catalog)){
            return 1-energy;
        }
        var deliverable = catalog.getEnergyNeeds(creep, data);
        if(deliverable.length > 0 && RoomUtil.getEnergy(creep) > 0){
            return (0.5 - energy) + (data.priority || 0) + (creep.pos.getRangeTo(deliverable[0])/25) + (RoomUtil.getEnergyPercent(deliverable[0]));
        }else{
            return false;
        }
    }

    start(creep, data, catalog){
        if(super.start(creep, data, catalog)){
            return true;
        }
        var deliverable = catalog.getEnergyNeeds(creep, data);
        if(deliverable.length > 0){
            creep.memory.traits.deliver = deliverable[0].id;
            return RoomUtil.exists(creep.memory.traits.deliver);
        }else{
            return false;
        }
    }

    process(creep, data, catalog){
        if(super.process(creep, data, catalog)){
            return;
        }
        var target = Game.getObjectById(creep.memory.traits.deliver);
        var result = creep.transfer(target, RESOURCE_ENERGY);
        if(result == ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        }
    }
};

module.exports = DeliverBehavior;