"use strict";

var Controller = require('./controller');
var Spawner = require('./spawner');
var WorkManager = require('./workmanager');
var Catalog = require('./catalog');
var Misc = require('./misc');

module.exports.loop = function () {
    if(!Memory.upgradedLogic){
        Misc.setSettings();
        Memory.updateTime = 0;
        Spawner.resetBehavior(catalog);
        Memory.upgradedLogic = true;
    }
    if(!Memory.settings){
        Misc.setSettings();
    }

    Misc.mourn();

    var catalog = new Catalog();

    if(Memory.updateTime < Game.time || !Memory.updateTime){
        Misc.updateStats(catalog);
        Memory.updateTime = Game.time + Memory.settings.updateDelta;
    }

    // console.log(catalog.getRealDistance(Game.getObjectById('50b5c10d0c10262'), Game.getObjectById('b5360d33f1206d9')));

    catalog.jobs.generate();
    catalog.jobs.allocate();
    WorkManager.process(catalog);
    Spawner.spawn(catalog);
    Controller.control(catalog);
}