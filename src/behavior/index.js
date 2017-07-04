"use strict";

var Avoid = require('./avoid');
var Boost = require('./boost');
var Convert = require('./convert');
var Defend = require('./defend');
var Energy = require('./energy');
var MinecartAction = require('./minecart');
var Rampart = require('./rampart');
var Repair = require('./repair');
var SelfHeal = require('./selfheal');

module.exports = function(){
    return {
        avoid: new Avoid(),
        boost: new Boost(),
        convert: new Convert(),
        defend: new Defend(),
        energy: new Energy(),
        minecart: new MinecartAction(),
        rampart: new Rampart(),
        repair: new Repair(),
        selfheal: new SelfHeal()
    };
};