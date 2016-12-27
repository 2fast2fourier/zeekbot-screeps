"use strict";

var Controller = require('./controller');
var Spawner = require('./spawner');
var WorkManager = require('./workmanager');
var Catalog = require('./catalog');
var Misc = require('./misc');
var Production = require('./production');

module.exports.loop = function () {
    var start = Game.cpu.getUsed();
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
    var production = new Production(catalog);

    if(!Memory.transfer){
        Memory.transfer = {
            lab: {},
            energy: {}
        };
        _.forEach(catalog.buildings.lab, lab => {
            Memory.transfer.lab[lab.id] = false;
            Memory.transfer.energy[lab.id] = lab.energyCapacity;
        });
        _.forEach(catalog.buildings.terminal, terminal => {
            Memory.transfer.energy[terminal.id] = 50000;
        });
    }

    if(Memory.updateTime < Game.time || !Memory.updateTime || !Memory.stats){
        Misc.updateStats(catalog);
        Memory.updateTime = Game.time + Memory.settings.updateDelta;
    }
    // var cat = Game.cpu.getUsed();

    production.process();

    catalog.jobs.generate();
    catalog.jobs.allocate();

    // console.log(_.size(catalog.jobs.jobs.repair), catalog.jobs.capacity.repair);
    // _.forEach(catalog.jobs.jobs.transfer, (job, id) => console.log(id, job.target, job.pickup, job.amount, job.resource));

    // var jobs = Game.cpu.getUsed();
    WorkManager.process(catalog);

    // var worker = Game.cpu.getUsed();
    Spawner.spawn(catalog);

    // var spawner = Game.cpu.getUsed();
    Controller.control(catalog);

    // var controller = Game.cpu.getUsed();
    // if(Game.cpu.getUsed() > Game.cpu.limit){
        // console.log('---- start', Game.cpu.bucket, start, Game.cpu.getUsed(),'----');
        // console.log('catalog', cat - start);
        // console.log('jobs', jobs - cat);
        // console.log('worker', worker - jobs);
        // console.log('spawner', spawner - worker);
        // console.log('controller', controller - spawner);
    // }

    
    var usage = Game.cpu.getUsed() - start;
    var profile = Memory.stats.profile;
    profile.avg = (profile.avg*profile.count + usage)/(profile.count+1);
    profile.count++;
    if(profile.max < usage){
        profile.max = usage;
    }
    if(profile.min > usage){
        profile.min = usage;
    }
}