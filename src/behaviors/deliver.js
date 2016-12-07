"use strict";

var RoomUtil = require('../roomutil');
var { RemoteBaseBehavior } = require('./base');


class DeliverBehavior extends RemoteBaseBehavior {
    constructor(){ super('deliver'); };

    stillValid(creep, data, catalog){
        var storage = RoomUtil.getStorage(creep);
        if(storage > 0 && super.stillValid(creep, data, catalog)){
            return true;
        }
        var target = this.target(creep);
        if(data.maxRange && creep.pos.getRangeTo(target) > data.maxRange){
            return false;
        }
        if(storage == 0 || target == null){
            return false;
        }else{
            return RoomUtil.getStoragePercent(target) < 0.85 && target.pos.roomName == creep.pos.roomName;
        }
    }

    bid(creep, data, catalog){
        var storage = RoomUtil.getStoragePercent(creep);
        if(storage > 0.1 && super.bid(creep, data, catalog)){
            return 1-storage;
        }
        var deliverable = catalog.getEnergyNeeds(creep, data);
        if(deliverable.length > 0 && RoomUtil.getStorage(creep) > 0){
            return (0.5 - storage) + (data.priority || 0) + (creep.pos.getRangeTo(deliverable[0])/25) + (RoomUtil.getStoragePercent(deliverable[0]));
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
            this.setTrait(creep, deliverable[0].id);
            return this.exists(creep);
        }else{
            return false;
        }
    }

    process(creep, data, catalog){
        if(super.process(creep, data, catalog)){
            return;
        }
        var target = this.target(creep);
        var transferred = false;
        _.forEach(creep.carry, (count, type) =>{
            if(!transferred && count > 0){
                var result = creep.transfer(target, type);
                transferred = result == OK;
                if(result == ERR_NOT_IN_RANGE) {
                    creep.moveTo(target);
                    transferred = true;
                }
            }
        });
    }
};

module.exports = DeliverBehavior;