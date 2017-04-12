"use strict";

var Avoid = require('./avoid');
var Boost = require('./boost');
var Defend = require('./defend');
var Energy = require('./energy');
var MinecartAction = require('./minecart');
var Repair = require('./repair');
var SelfHeal = require('./selfheal');

module.exports = function(){
    return {
        avoid: new Avoid(),
        boost: new Boost(),
        defend: new Defend(),
        energy: new Energy(),
        minecart: new MinecartAction(),
        repair: new Repair(),
        selfheal: new SelfHeal()
    };
};