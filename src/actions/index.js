"use strict";

var Avoid = require('./avoid');
var Repair = require('./repair');
var SelfHeal = require('./selfheal');

module.exports = function(catalog){
    return {
        avoid: new Avoid(catalog),
        repair: new Repair(catalog),
        selfheal: new SelfHeal(catalog)
    };
};