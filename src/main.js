"use strict";

var Poly = require('./poly');
var Startup = require('./startup');
var Traveller = require('./traveller');

var Hegemony = require('./hegemony');
var AutoBuilder = require('./autobuilder');
var Cluster = require('./cluster');
var Controller = require('./controller');
var Spawner = require('./spawner');
var Worker = require('./worker');
var Production = require('./production');

var REPAIR_CAP = 2000000;

module.exports.loop = function () {
    //// Startup ////
    PathFinder.use(true);
    Poly();
    Game.hegemony = new Hegemony();
    Startup.start();
    
    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
        }
    }
    Game.profile('memory', Game.cpu.getUsed());
    Cluster.init();
    Startup.processActions();

    let production = new Production();
    

    //// Process ////

    let bootstrap = false;
    if(Memory.bootstrap){
        let target = Game.clusters[Memory.bootstrap];
        bootstrap = target;
    }

    let ix = 0;
    let autobuildOffset = _.size(Game.clusters) * 100;
    for(let name in Game.clusters){
        let clusterStart = Game.cpu.getUsed();
        let cluster = Game.clusters[name];
        Worker.process(cluster);
        
        if(Game.interval(5)){
            let spawnlist = Spawner.generateSpawnList(cluster, cluster);
            if(!Spawner.processSpawnlist(cluster, spawnlist, cluster) && bootstrap && cluster.totalEnergy > 5000){
                spawnlist = Spawner.generateSpawnList(cluster, bootstrap);
                Spawner.processSpawnlist(cluster, spawnlist, bootstrap);
            }
        }

        Controller.control(cluster);
        production.process(cluster);
        let iy = 0;
        for(let buildRoom of cluster.roomflags.autobuild){
            if(Game.intervalOffset(autobuildOffset, ix * 75 + iy)){
                let builder = new AutoBuilder(buildRoom);
                builder.buildTerrain();
                let buildList = builder.generateBuildingList();
                if(buildList){
                    builder.autobuild(buildList);
                }
            }
            if(Game.intervalOffset(autobuildOffset, 10)){
                AutoBuilder.buildInfrastructureRoads(cluster);
            }
            iy++;
        }

        if(Game.interval(100) && cluster.quota.repair < 500000 && cluster.totalEnergy > 500000 && cluster.opts.repair < REPAIR_CAP){
            cluster.opts.repair += 10000;
            Game.notify('Increasing repair target in ' + cluster.id + ' to ' + cluster.opts.repair);
            console.log('Increasing repair target in ' + cluster.id + ' to ' + cluster.opts.repair);
        }


        Game.profile(name, Game.cpu.getUsed() - clusterStart);
        ix++;
    }

    Controller.hegemony();

    if(Game.flags.autobuildDebug){
        let buildRoom = Game.flags.autobuildDebug.room;
        if(buildRoom){
            let start = Game.cpu.getUsed();
            let builder = new AutoBuilder(buildRoom);
            builder.buildTerrain();
            let structs = builder.generateBuildingList();
            Game.profile('builder', Game.cpu.getUsed() - start);
        }
    }
    // AutoBuilder.processRoadFlags();

    if(Game.interval(1999) && Game.cpu.bucket > 9000){
        var line = _.first(_.keys(Memory.cache.path));
        if(line){
            console.log('Clearing pathing cache for room:', line);
            delete Memory.cache.path[line];
        }
    }

    if(Game.interval(50)){
        for(var roomName in Memory.rooms){
            if(_.size(Memory.rooms[roomName]) == 0){
                delete Memory.rooms[roomName];
            }
        }
    }
    
    //// Wrapup ////
    Game.finishProfile();
    Game.profile('cpu', Game.cpu.getUsed());

    if(Game.cpu.bucket < 5000){
        Game.note('cpubucket', 'CPU bucket under limit!');
    }
    if(Game.cpu.bucket < 600){
        Game.note('cpubucketcrit', 'CPU bucket critical!');
    }
}