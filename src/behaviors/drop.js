"use strict";

var RoomUtil = require('../roomutil');
var { BaseBehavior } = require('./base');

class DropBehavior extends BaseBehavior {
    constructor(){ super('drop'); }

    stillValid(creep, data, catalog){
        return RoomUtil.getEnergyPercent(creep) > 0.75;
    }

    bid(creep, data, catalog){
        return 1 - RoomUtil.getEnergyPercent(creep) + _.get(data, 'priority', 0);
    }

    start(creep, data, catalog){
        return true;
    }

    process(creep, data, catalog){
        creep.drop(RESOURCE_ENERGY);
    }
};

module.exports = DropBehavior;