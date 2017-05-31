"use strict";

var Poly = require('./poly');
var Startup = require('./startup');
var Traveller = require('./traveller');

var Federation = require('./federation');
var AutoBuilder = require('./autobuilder');
var Cluster = require('./cluster');
var Controller = require('./controller');
var Spawner = require('./spawner');
var Worker = require('./worker');
var Production = require('./production');
var Pathing = require('./pathing');

var REPAIR_CAP = 5000000;

module.exports.loop = function () {
    //// Startup ////
    PathFinder.use(true);
    Poly();
    Game.federation = new Federation();
    Startup.start();
    
    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
        }
    }
    Game.profile('memory', Game.cpu.getUsed());
    Cluster.init();
    Startup.processActions();

    const production = new Production();

    const allocated = [];

    Game.matrix.startup();
    

    //// Process ////

    let bootstrap = false;
    let bootstrapper = false;
    if(Memory.bootstrap || Game.flags.bootstrap){
        if(Memory.bootstrap){
            bootstrap = Game.clusters[Memory.bootstrap];
        }
        if(!bootstrap && Game.flags.bootstrap && Game.flags.bootstrap.room){
            bootstrap = Game.flags.bootstrap.room.cluster;
        }
        if(bootstrap && Game.flags.bootstrapper){
            bootstrapper = Game.flags.bootstrapper.room.cluster;
        }
    }

    let initTime = Game.cpu.getUsed();

    // let autobuildOffset = _.size(Game.clusters) * 100;
    let ix = 50;
    let autobuildOffset = 1000;
    for(let name in Game.clusters){
        try{
            Game.longtermAdd('s-'+name, 0);
            Game.longtermAdd('se-'+name, 0);
            let clusterStart = Game.cpu.getUsed();
            let cluster = Game.clusters[name];

            Game.matrix.process(cluster);

            Worker.process(cluster);
            
            if(Game.interval(5)){
                let spawnlist = Spawner.generateSpawnList(cluster, cluster);
                if(!Spawner.processSpawnlist(cluster, spawnlist, cluster) && bootstrap && bootstrapper && bootstrapper.id == cluster.id && cluster.totalEnergy > 5000){
                    spawnlist = Spawner.generateSpawnList(cluster, bootstrap);
                    Spawner.processSpawnlist(cluster, spawnlist, bootstrap);
                }
            }

            Controller.control(cluster, allocated);
            production.process(cluster);

            let iy = 1;
            for(let buildRoom of cluster.roomflags.autobuild){
                if(Game.intervalOffset(autobuildOffset, ix + iy)){
                    let builder = new AutoBuilder(buildRoom);
                    builder.buildTerrain();
                    builder.autobuild(builder.generateBuildingList());
                }
                iy++;
            }

            if(Game.interval(100) && cluster.quota.repair > 1 && cluster.quota.repair < 750000 && cluster.totalEnergy > 400000 && cluster.opts.repair < REPAIR_CAP){
                cluster.opts.repair += 50000;
                Game.notify('Increasing repair target in ' + cluster.id + ' to ' + cluster.opts.repair);
                console.log('Increasing repair target in ' + cluster.id + ' to ' + cluster.opts.repair);
            }

            Game.profile(name, Game.cpu.getUsed() - clusterStart);
            ix+= 100;
        }catch(e){
            console.error(cluster.id + ' - ' + e.toString());
            Game.notify(cluster.id + ' - ' + e.toString());
        }
    }
    
    let clusterEndTime = Game.cpu.getUsed();

    Controller.federation(allocated);

    AutoBuilder.processRoadFlags();



    if(Game.interval(4899) && Game.cpu.bucket > 9000){
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

    Game.profile('external', initTime + Game.cpu.getUsed() - clusterEndTime);
    Game.profile('clusters', clusterEndTime - initTime);

    if(Game.cpu.bucket < 5000){
        Game.note('cpubucket', 'CPU bucket under limit! '+Game.cpu.bucket);
    }
    if(Game.cpu.bucket < 600){
        Game.note('cpubucketcrit', 'CPU bucket critical! '+Game.cpu.bucket);
    }
}