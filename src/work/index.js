"use strict";

var Build = require('./build');
var Deliver = require('./deliver');
var Drop = require('./drop');
// var Heal = require('./heal');
var Mine = require('./mine');
var Pickup = require('./pickup');
var Repair = require('./repair');
var Upgrade = require('./upgrade');

module.exports = function(catalog){
    return {
        build: new Build(catalog),
        deliver: new Deliver(catalog),
        drop: new Drop(catalog),
        mine: new Mine(catalog),
        pickup: new Pickup(catalog),
        repair: new Repair(catalog),
        upgrade: new Upgrade(catalog)
    };
};