"use strict";

var { BaseBehavior } = require('./base');

class NOP extends BaseBehavior {
    constructor(){ super('none'); }
};

var { ClaimBehavior, ReserveBehavior } = require('./claim');

var Attack = require('./attack');
var Build = require('./build');
var Deliver = require('./deliver');
var Drop = require('./drop');
var EmergencyDeliver = require('./emergencydeliver');
var Mining = require('./mining');
var Repair = require('./repair');
var Upgrade = require('./upgrade');
var Pickup = require('./pickup');

module.exports = {
    attack: new Attack(),
    defend: new NOP(),
    build: new Build(),
    emergencydeliver: new EmergencyDeliver(),
    deliver: new Deliver(),
    drop: new Drop(),
    mining: new Mining(),
    repair: new Repair(),
    upgrade: new Upgrade(),
    claim: new ClaimBehavior(),
    reserve: new ReserveBehavior(),
    pickup: new Pickup()
}