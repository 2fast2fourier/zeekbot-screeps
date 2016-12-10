"use strict";

var Controller = require('./controller');
// var Spawner = require('./spawner');
// var Behavior = require('./behavior');
var Catalog = require('./catalog');
var Misc = require('./misc');

module.exports.loop = function () {
    if(!Memory.settings){
        Misc.setSettings();
    }

    Misc.mourn();

    var catalog = new Catalog();

    if(Memory.updateTime < Game.time || !Memory.updateTime){
        Misc.updateStats(catalog);
        Memory.updateTime = Game.time + Memory.settings.updateDelta;
    }

    catalog.jobs.generate();
    catalog.jobs.allocate();
    // Spawner.spawn(catalog);
    // Behavior.process(catalog);
    Controller.control(catalog);
}