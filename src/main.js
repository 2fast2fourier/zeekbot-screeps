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

var REPAIR_CAP = 10000000;

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
    
    if(Game.interval(100)){
        _.forEach(Game.clusters, cluster =>cluster.processStats());
    }
    if(Game.interval(5000)){
        _.forEach(Game.clusters, cluster => cluster.processLongterm());
    }

    Startup.processActions();

    const allocated = {};

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
    Game.profileAdd('autobuy', 0);

    let ix = 50;
    let autobuildOffset = 1000;
    for(let name in Game.clusters){
        try{
            let clusterStart = Game.cpu.getUsed();
            let cluster = Game.clusters[name];
            cluster.longtermAdd('spawn', 0);
            cluster.longtermAdd('transfer', 0);

            Game.matrix.process(cluster);

            Worker.process(cluster);
            
            let spawnStart = Game.cpu.getUsed();
            if(Game.interval(5) && Spawner.hasFreeSpawn(cluster)){
                let spawnlist = Spawner.generateSpawnList(cluster, cluster);
                if(!Spawner.processSpawnlist(cluster, spawnlist, cluster) && bootstrap && bootstrapper && bootstrapper.id == cluster.id && cluster.totalEnergy > 5000){
                    spawnlist = Spawner.generateSpawnList(cluster, bootstrap);
                    Spawner.processSpawnlist(cluster, spawnlist, bootstrap);
                }
            }
            Game.profileAdd('spawncpu', Game.cpu.getUsed() - spawnStart);

            Controller.control(cluster, allocated);

            let iy = 1;
            for(let buildRoom of cluster.roomflags.autobuild){
                if(Game.intervalOffset(autobuildOffset, ix + iy)){
                    let builder = new AutoBuilder(buildRoom);
                    builder.buildTerrain();
                    builder.autobuild(builder.generateBuildingList());
                }
                iy++;
            }

            if(Game.interval(100) && _.get(cluster, 'work.repair.damage.heavy', Infinity) < 350000 && cluster.totalEnergy > 400000 * cluster.structures.storage.length && cluster.opts.repair < REPAIR_CAP){
                cluster.opts.repair += 50000;
                // Game.notify('Increasing repair target in ' + cluster.id + ' to ' + cluster.opts.repair);
                console.log('Increasing repair target in ' + cluster.id + ' to ' + cluster.opts.repair);
            }

            cluster.profile('cpu', Game.cpu.getUsed() - clusterStart);
            ix+= 100;
        }catch(e){
            console.log(name, e);
            Game.notify(name + ' - ' + e.toString());
            throw e;
        }
    }
    
    let clusterEndTime = Game.cpu.getUsed();

    try{
        Production.process();
        Controller.federation(allocated);
    }catch(e){
        console.log('federation', e);
        Game.notify('federation: ' + e.toString());
        throw e;
    }

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
    _.forEach(Game.clusters, cluster => cluster.finishProfile());
    Game.finishProfile();    

    Game.profile('external', initTime + Game.cpu.getUsed() - clusterEndTime);
    Game.profile('clusters', clusterEndTime - initTime);

    if(Game.cpu.bucket < 5000){
        Game.note('cpubucket', 'CPU bucket under limit! '+Game.cpu.bucket);
    }
    if(Game.cpu.bucket < 600){
        Game.note('cpubucketcrit', 'CPU bucket critical! '+Game.cpu.bucket);
    }
    Memory.stats.bucket = Game.cpu.bucket;
    Memory.stats.clusters = {};
    _.forEach(Game.clusters, cluster => {
        Memory.stats.clusters[cluster.id] = _.assign({}, cluster.longstats, cluster.stats);
    });
    Memory.stats.tick = Game.time;
    Memory.stats.tickmod = Game.time % 100;
    // Memory.stats.types = _.mapValues(_.groupBy(Game.creeps, 'memory.type'), list => list.length);
    Memory.stats.gcl = Game.gcl.level + Game.gcl.progress / Game.gcl.progressTotal;
    var cpu = Game.cpu.getUsed();
    Game.profile('cpu', cpu);
    Memory.stats.cpu = cpu;
}