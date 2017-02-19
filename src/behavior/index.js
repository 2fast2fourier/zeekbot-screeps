"use strict";

var AssignRoomAction = require('./assignroom');
var Avoid = require('./avoid');
var Boost = require('./boost');
var Energy = require('./energy');
var MinecartAction = require('./minecart');
var Repair = require('./repair');
var SelfHeal = require('./selfheal');

module.exports = function(){
    return {
        // assignRoom: new AssignRoomAction(),
        // avoid: new Avoid(),
        // boost: new Boost(),
        energy: new Energy(),
        minecart: new MinecartAction(),
        repair: new Repair(),
        selfheal: new SelfHeal()
    };
};