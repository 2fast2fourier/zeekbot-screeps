"use strict";

var RoomUtil = require('../roomutil');
var { RemoteBaseBehavior } = require('./base');

class RepairBehavior extends RemoteBaseBehavior {
    constructor(){ super('repair'); }

    stillValid(creep, data, catalog){
        if(super.stillValid(creep, data, catalog)){
            return true;
        }
        var target = Game.getObjectById(creep.memory.traits.repair);
        return creep.carry.energy > 0 && target && target.hits < target.hitsMax && target.hits < Memory.repairTarget;
    }

    bid(creep, data, catalog){
        if(super.bid(creep, data, catalog)){
            return -999;
        }
        var ideal = data.ideal || 0;
        var repairsActive = _.get(catalog.traitCount, 'repair', 0);
        var jobPriority = 0;
        var energy = creep.carry.energy / creep.carryCapacity;
        if(repairsActive < ideal){
            jobPriority = (repairsActive-ideal)*11;
        }
        var repairable = _.filter(catalog.buildings[creep.pos.roomName], building => building.hits < building.hitsMax && building.hits < Memory.repairTarget);
        if(repairable.length > 0 && RoomUtil.getEnergy(creep) > 0){
            return (1 - energy) + (data.priority || 0) + jobPriority*energy;
        }else{
            return false;
        }
    }

    start(creep, data, catalog){
        if(super.start(creep, data, catalog)){
            return true;
        }
        var repairable = _.sortBy(_.filter(catalog.buildings[creep.pos.roomName], building => building.hits < building.hitsMax && building.hits < Memory.repairTarget),
                                  (target)=>target.hits / Math.min(target.hitsMax, Memory.repairTarget) + creep.pos.getRangeTo(target)/100);
        if(repairable.length > 0){
            creep.memory.traits.repair = repairable[0].id;
            creep.say('repair');
            return RoomUtil.exists(creep.memory.traits.repair);
        }else{
            return false;
        }
    }

    process(creep, data, catalog){
        if(super.process(creep, data, catalog)){
            return true;
        }
        var target = Game.getObjectById(creep.memory.traits.repair);
        if(target && creep.repair(target) == ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        }
    }
};

module.exports = RepairBehavior;