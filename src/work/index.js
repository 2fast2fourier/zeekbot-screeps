"use strict";

var Attack = require('./attack');
var Build = require('./build');
var Defend = require('./defend');
var Deliver = require('./deliver');
var Drop = require('./drop');
var Heal = require('./heal');
var Idle = require('./idle');
var Keep = require('./keep');
var Mine = require('./mine');
var Observe = require('./observe');
var Pickup = require('./pickup');
var Repair = require('./repair');
var Reserve = require('./reserve');
var Upgrade = require('./upgrade');

module.exports = function(catalog){
    return {
        attack: new Attack(catalog),
        build: new Build(catalog),
        defend: new Defend(catalog),
        deliver: new Deliver(catalog),
        drop: new Drop(catalog),
        heal: new Heal(catalog),
        idle: new Idle(catalog),
        keep: new Keep(catalog),
        mine: new Mine(catalog),
        observe: new Observe(catalog),
        pickup: new Pickup(catalog),
        repair: new Repair(catalog),
        reserve: new Reserve(catalog),
        upgrade: new Upgrade(catalog)
    };
};