"use strict";

var RoomUtil = require('../roomutil');
var { BaseBehavior } = require('./base');

class DropBehavior extends BaseBehavior {
    constructor(){ super('drop'); }

    stillValid(creep, data, catalog){
        return RoomUtil.getStoragePercent(creep) > 0.75;
    }

    bid(creep, data, catalog){
        return 1 - RoomUtil.getStoragePercent(creep) + _.get(data, 'priority', 0);
    }

    start(creep, data, catalog){
        return true;
    }

    process(creep, data, catalog){
        var dropped = false;
        _.forEach(creep.carry, (count, type) =>{
            if(!dropped && count > 0){
                var result = creep.drop(type);
                dropped = result == OK;
            }
        });
    }
};

module.exports = DropBehavior;