"use strict";

var Controller = require('./controller');
var Spawner = require('./spawner');
var WorkManager = require('./workmanager');
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
    // _.forEach(catalog.jobs.jobs['upgrade'], (upgrade, id)=>console.log(id, upgrade, upgrade.allocated));
    WorkManager.process(catalog);
    Spawner.spawn(catalog);
    Controller.control(catalog);
}