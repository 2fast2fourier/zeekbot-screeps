"use strict";

var RoomUtil = require('../roomutil');
var { RemoteBaseBehavior } = require('./base');

class UpgradeBehavior extends RemoteBaseBehavior {
    constructor(){ super('upgrade'); }

    stillValid(creep, data, catalog){
        if(super.stillValid(creep, data, catalog)){
            return true;
        }
        return creep.carry.energy > 0 && creep.room.controller && creep.room.controller.my;
    }

    bid(creep, data, catalog){
        if(super.bid(creep, data, catalog)){
            return -999;
        }
        var ideal = data.ideal || 0;
        var upgradersActive = _.get(catalog.traitCount, 'upgrade', 0);
        var jobPriority = 0;
        var energy = creep.carry.energy / creep.carryCapacity;
        if(upgradersActive < ideal){
            jobPriority = (upgradersActive-ideal)*11;
        }
        if(creep.room.controller && creep.room.controller.my && RoomUtil.getEnergy(creep) > 0){
            return (1 - energy) + (data.priority || 0) + jobPriority*energy;
        }else{
            return false;
        }
    }

    start(creep, data, catalog){
        if(super.start(creep, data, catalog)){
            return true;
        }
        creep.say('upgrading');
        creep.memory.traits.upgrade = true;
        return creep.room.controller.my && RoomUtil.getEnergy(creep) > 0;
    }

    process(creep, data, catalog){
        if(super.process(creep, data, catalog)){
            return;
        }
        if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller);
        }
    }
};

module.exports = UpgradeBehavior;