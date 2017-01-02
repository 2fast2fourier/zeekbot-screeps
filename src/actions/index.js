"use strict";

var Avoid = require('./avoid');
var Boost = require('./boost');
var MinecartAction = require('./minecart');
var Repair = require('./repair');
var SelfHeal = require('./selfheal');

module.exports = function(catalog){
    return {
        avoid: new Avoid(catalog),
        boost: new Boost(catalog),
        minecart: new MinecartAction(catalog),
        repair: new Repair(catalog),
        selfheal: new SelfHeal(catalog)
    };
};