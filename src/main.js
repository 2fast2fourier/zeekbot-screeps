"use strict";

var Controller = require('./controller');
var Spawner = require('./spawner');
var WorkManager = require('./workmanager');
var Catalog = require('./catalog');
var Misc = require('./misc');
var Production = require('./production');

module.exports.loop = function () {
    PathFinder.use(true);
    Misc.initMemory();
    if(!Memory.settings){
        Misc.setSettings();
    }

    Misc.mourn();

    var catalog = new Catalog();
    var production = new Production(catalog);

    if(Memory.refreshTransfer){
        _.forEach(catalog.buildings.lab, lab => {
            Memory.transfer.lab[lab.id] = false;
            Memory.transfer.energy[lab.id] = lab.energyCapacity;
        });
        _.forEach(catalog.buildings.terminal, terminal => {
            Memory.transfer.energy[terminal.id] = 50000;
        });
        console.log('refreshed transfer settings');
        Memory.refreshTransfer = false;
    }

    if(Memory.updateTime < Game.time || !Memory.updateTime || !Memory.stats){
        Misc.updateStats(catalog);
        Memory.updateTime = Game.time + Memory.settings.updateDelta;
    }

    var startup = Game.cpu.getUsed();
    catalog.profile('startup', startup);

    production.process();

    catalog.jobs.generate();
    catalog.jobs.allocate();
    catalog.quota.process();

    // console.log(_.size(catalog.jobs.jobs.keep), catalog.jobs.capacity.keep);
    // _.forEach(catalog.jobs.jobs.transfer, (job, id) => console.log(id, job.target, job.pickup, job.amount, job.resource));

    var jobs = Game.cpu.getUsed();
    catalog.profile('jobs', jobs - startup);
    
    WorkManager.process(catalog);

    var worker = Game.cpu.getUsed();
    catalog.profile('worker', worker - jobs);

    Spawner.spawn(catalog);

    var spawner = Game.cpu.getUsed();
    Controller.control(catalog);
    catalog.profile('controller', Game.cpu.getUsed() - spawner);

    catalog.finishProfile();
    catalog.profile('cpu', Game.cpu.getUsed());
}