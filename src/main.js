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

module.exports.loop = function () {
    //// Startup ////
    PathFinder.use(true);
    Poly();
    Startup.start();
    
    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
        }
    }
    Game.profile('memory', Game.cpu.getUsed());
    Game.hegemony = new Hegemony();
    Cluster.init();
    Startup.processActions();

    let production = new Production();
    

    //// Process ////

    let bootstrap = false;
    if(Memory.bootstrap){
        let target = Game.clusters[Memory.bootstrap];
        bootstrap = target;
    }

    for(let name in Game.clusters){
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
        
        if(Game.interval(150)){
            for(let buildRoom of cluster.roomflags.autobuild){
                let builder = new AutoBuilder(buildRoom);
                builder.buildTerrain();
                let buildList = builder.generateBuildingList();
                if(buildList){
                    builder.autobuild(buildList);
                }
            }
            AutoBuilder.buildInfrastructureRoads(cluster);

            _.forEach(Memory.rooms, (room, name) =>{
                if(!room.cluster){
                    delete Memory.rooms[name];
                }
            });
        }
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

    if(Game.interval(999) && Game.cpu.bucket > 9000){
        var line = _.first(_.keys(Memory.cache.path));
        if(line){
            console.log('Clearing pathing cache for room:', line);
            delete Memory.cache.path[line];
        }
    }
    
    //// Wrapup ////
    Game.finishProfile();
    Game.profile('cpu', Game.cpu.getUsed());

    if(Game.cpu.bucket < 5000){
        Util.notify('cpubucket', 'CPU bucket under limit!');
    }
    if(Game.cpu.bucket < 600){
        Util.notify('cpubucketcrit', 'CPU bucket critical!');
    }
}