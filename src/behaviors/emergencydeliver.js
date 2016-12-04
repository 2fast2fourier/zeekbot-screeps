"use strict";

var RoomUtil = require('../roomutil');
var { BaseBehavior } = require('./base');

class EmergencyDeliver extends BaseBehavior {
    constructor(){ super('emergencydeliver'); };

    stillValid(creep, data, catalog){
        var target = this.target(creep);
        return target && creep.carry.energy > 0 && RoomUtil.getEnergyPercent(target) < 0.9;
    }

    bid(creep, data, catalog){
        if(RoomUtil.getEnergyPercent(creep) > 0.25 && _.get(catalog.deficits, creep.pos.roomName, 0) > 0){
            return -999;
        }
        return false;
    }

    start(creep, data, catalog){
        var opts = {
            ignoreCreeps: true,
            containerTypes: [
                STRUCTURE_EXTENSION,
                STRUCTURE_SPAWN
            ]
        };
        var deliverable = catalog.getEnergyNeeds(creep, opts);
        this.setTrait(creep, _.get(deliverable, '[0].id', false));
        return this.exists(creep);
    }

    process(creep, data, catalog){
        var target = this.target(creep);
        var result = creep.transfer(target, RESOURCE_ENERGY);
        if(result == ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        }
    }
}

module.exports = EmergencyDeliver;