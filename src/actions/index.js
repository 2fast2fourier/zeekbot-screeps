"use strict";

var Avoid = require('./avoid');
var SelfHeal = require('./selfheal');

module.exports = function(catalog){
    return {
        avoid: new Avoid(catalog),
        selfheal: new SelfHeal(catalog)
    };
};