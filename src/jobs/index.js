"use strict";

var Build = require('./build');
var Deliver = require('./deliver');
var Mine = require('./mine');
var Pickup = require('./pickup');
var Repair = require('./repair');
var Upgrade = require('./upgrade');
// var Heal = require('./heal');

module.exports = function(catalog){
    return {
        build: new Build(catalog),
        deliver: new Deliver(catalog),
        mine: new Mine(catalog),
        pickup: new Pickup(catalog),
        repair: new Repair(catalog),
        upgrade: new Upgrade(catalog)
    };
};