"use strict";

var Controller = require('./controller');
var Spawner = require('./spawner');
var WorkManager = require('./workmanager');
var Catalog = require('./catalog');
var Misc = require('./misc');
var Production = require('./production');
var Util = require('./util');

module.exports.loop = function () {
    PathFinder.use(true);
    Misc.initMemory();
    if(!Memory.settings){
        Misc.setSettings();
    }
    Util.profile('memory', Game.cpu.getUsed());
    
    Misc.mourn();

    var catalog = new Catalog();
    var production = new Production(catalog);

    if(Util.interval(Memory.settings.updateDelta) || !Memory.stats){
        Misc.updateStats(catalog);
    }

    if(Util.interval(50, 5)){
        Misc.miscUpdate(catalog);
    }

    var startup = Game.cpu.getUsed();
    catalog.profile('startup', startup);

    production.process();

    catalog.jobs.generate();
    catalog.jobs.allocate();
    catalog.quota.process();

    var jobs = Game.cpu.getUsed();
    catalog.profile('jobs', jobs - startup);
    
    WorkManager.process(catalog);

    var worker = Game.cpu.getUsed();
    catalog.profile('worker', worker - jobs);

    Spawner.spawn(catalog);
    
    // var spawner = Game.cpu.getUsed();
    Controller.control(catalog);
    catalog.profile('controller', Game.cpu.getUsed() - worker);

    catalog.finishProfile();
    catalog.profile('cpu', Game.cpu.getUsed());

    if(Game.cpu.bucket < 5000){
        Util.notify('cpubucket', 'CPU bucket under limit!');
    }
    if(Game.cpu.bucket < 600){
        Util.notify('cpubucketcrit', 'CPU bucket critical!');
    }
}