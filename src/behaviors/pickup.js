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
        var storage;
        if(creep.memory.mineralType){
            storage = RoomUtil.getResource(target, creep.memory.mineralType);
        }else{
            storage = RoomUtil.getEnergy(target);
        }
        return target && target.pos.roomName == creep.pos.roomName && storage > 0 && RoomUtil.getStoragePercent(creep) < 0.9;
    }

    bid(creep, data, catalog){
        var storage = RoomUtil.getStoragePercent(creep);
        if(storage < 0.2 && super.bid(creep, data, catalog)){
            return storage;
        }
        var targets;
        if(creep.memory.mineralType){
            targets = catalog.getResourceContainers(creep, creep.memory.mineralType, data.containerTypes);
        }else{
            targets = catalog.getEnergyContainers(creep, data.containerTypes);
        }
        if(storage > 0.5 || !targets.length){
            return false;
        }
        return storage + creep.pos.getRangeTo(targets[0])/50;
    }

    start(creep, data, catalog){
        if(super.start(creep, data, catalog)){
            return true;
        }
        if(creep.memory.mineralType){
            this.setTrait(creep, _.get(catalog.getResourceContainers(creep, creep.memory.mineralType, data.containerTypes), '[0].id', false));
        }else{
            this.setTrait(creep, _.get(catalog.getEnergyContainers(creep, data.containerTypes), '[0].id', false));
        }
        return !!this.target(creep);
    }

    process(creep, data, catalog){
        if(super.process(creep, data, catalog)){
            return;
        }
        var target = this.target(creep);
        var type = _.get(creep.memory, 'mineralType', RESOURCE_ENERGY);
        if(target.resourceType && target.resourceType == type){
            var result = creep.pickup(target);
            if(result == ERR_NOT_IN_RANGE) {
                creep.moveTo(target);
            }
        }else{
            var result = creep.withdraw(target, type, Math.min(creep.carryCapacity - _.sum(creep.carry), RoomUtil.getResource(target, type)));
            if(result == ERR_NOT_IN_RANGE) {
                creep.moveTo(target);
            }
        }
    }

    setup(memory, data, catalog, room){
        if(data.mineral === true){
            memory.mineralType = RoomUtil.getStat(room, 'mineralType', false);
            console.log('setup mineral', memory.mineralType);
        }
    }
};

module.exports = PickupBehavior;