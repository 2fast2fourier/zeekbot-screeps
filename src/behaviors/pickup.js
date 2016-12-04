"use strict";

var RoomUtil = require('../roomutil');
var { RemoteBaseBehavior } = require('./base');

class PickupBehavior extends RemoteBaseBehavior {
    constructor(){ super('pickup'); }

    stillValid(creep, data, catalog){
        if(super.stillValid(creep, data, catalog)){
            return true;
        }
        var target = this.target(creep);
        return target && target.pos.roomName == creep.pos.roomName && RoomUtil.getEnergy(target) > 0 && RoomUtil.getEnergyPercent(creep) < 0.9;
    }

    bid(creep, data, catalog){
        var energy = RoomUtil.getEnergyPercent(creep);
        if(energy < 0.2 && super.bid(creep, data, catalog)){
            return energy;
        }
        if(energy > 0.75 || catalog.getAvailableEnergy(creep) < 1){
            return false;
        }
        return energy * 2;
    }

    start(creep, data, catalog){
        if(super.start(creep, data, catalog)){
            return true;
        }
        this.setTrait(creep, _.get(catalog.getEnergyContainers(creep, data.containerTypes), '[0].id', false));
        return !!this.target(creep);
    }

    process(creep, data, catalog){
        if(super.process(creep, data, catalog)){
            return;
        }
        var target = this.target(creep);
        if(target.resourceType && target.resourceType == RESOURCE_ENERGY){
            var result = creep.pickup(target);
            if(result == ERR_NOT_IN_RANGE) {
                creep.moveTo(target);
            }
        }else{
            var result = creep.withdraw(target, RESOURCE_ENERGY, Math.min(creep.carryCapacity - creep.carry.energy, RoomUtil.getEnergy(target)));
            if(result == ERR_NOT_IN_RANGE) {
                creep.moveTo(target);
            }
        }
    }
};

module.exports = PickupBehavior;