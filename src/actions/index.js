"use strict";

var AssignRoomAction = require('./assignroom');
var Avoid = require('./avoid');
var Boost = require('./boost');
var Energy = require('./energy');
var MinecartAction = require('./minecart');
var Repair = require('./repair');
var SelfHeal = require('./selfheal');

module.exports = function(catalog){
    return {
        assignRoom: new AssignRoomAction(catalog),
        avoid: new Avoid(catalog),
        boost: new Boost(catalog),
        energy: new Energy(catalog),
        minecart: new MinecartAction(catalog),
        repair: new Repair(catalog),
        selfheal: new SelfHeal(catalog)
    };
};