"use strict";

var Mine = require('./mine');
var Build = require('./build');
var Repair = require('./repair');
var Pickup = require('./pickup');
// var Heal = require('./heal');

module.exports = function(catalog){
    return {
        build: new Build(catalog),
        mine: new Mine(catalog),
        repair: new Repair(catalog),
        pickup: new Pickup(catalog)
    };
};