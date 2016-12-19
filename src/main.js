"use strict";

var Controller = require('./controller');
var Spawner = require('./spawner');
var WorkManager = require('./workmanager');
var Catalog = require('./catalog');
var Misc = require('./misc');

module.exports.loop = function () {
    // var start = Game.cpu.getUsed();
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
    // var cat = Game.cpu.getUsed();

    catalog.jobs.generate();
    catalog.jobs.allocate();

    // console.log(_.size(catalog.jobs.jobs.repair), catalog.jobs.capacity.repair);

    // var jobs = Game.cpu.getUsed();
    WorkManager.process(catalog);

    // var worker = Game.cpu.getUsed();
    Spawner.spawn(catalog);

    // var spawner = Game.cpu.getUsed();
    Controller.control(catalog);

    // var controller = Game.cpu.getUsed();
    // if(Game.cpu.getUsed() > Game.cpu.limit){
    //     console.log('---- start', Game.cpu.bucket, start, Game.cpu.getUsed(),'----');
    //     console.log('catalog', cat - start);
    //     console.log('jobs', jobs - cat);
    //     console.log('worker', worker - jobs);
    //     console.log('spawner', spawner - worker);
    //     console.log('controller', controller - spawner);
    // }
}