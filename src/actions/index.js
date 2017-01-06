"use strict";

var AssignRoomAction = require('./assignroom');
var Avoid = require('./avoid');
var Boost = require('./boost');
var MinecartAction = require('./minecart');
var Repair = require('./repair');
var SelfHeal = require('./selfheal');

module.exports = function(catalog){
    return {
        assignRoom: new AssignRoomAction(catalog),
        avoid: new Avoid(catalog),
        boost: new Boost(catalog),
        minecart: new MinecartAction(catalog),
        repair: new Repair(catalog),
        selfheal: new SelfHeal(catalog)
    };
};