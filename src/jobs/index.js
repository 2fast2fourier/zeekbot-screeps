"use strict";

var Build = require('./build');
var Deliver = require('./deliver');
var Mine = require('./mine');
var Idle = require('./idle');
var Observe = require('./observe');
var Pickup = require('./pickup');
var Repair = require('./repair');
var Reserve = require('./reserve');
var Upgrade = require('./upgrade');
var Heal = require('./heal');

module.exports = function(catalog){
    return {
        build: new Build(catalog),
        deliver: new Deliver(catalog),
        heal: new Heal(catalog),
        idle: new Idle(catalog),
        mine: new Mine(catalog),
        observe: new Observe(catalog),
        pickup: new Pickup(catalog),
        repair: new Repair(catalog),
        reserve: new Reserve(catalog),
        upgrade: new Upgrade(catalog)
    };
};