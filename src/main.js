"use strict";

var Poly = require('./poly');
var Startup = require('./startup');
var Traveller = require('./traveller');

var Cluster = require('./cluster');
var Controller = require('./controller');
var Spawner = require('./spawner');
var Worker = require('./worker');
// var Production = require('./production');

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
    Cluster.init();

    if(Game.interval(10)){
        Startup.processFlags();
    }

    //// Process ////

    _.forEach(Game.clusters, (cluster, name) =>{
        Worker.process(cluster);
        
        if(Game.interval(5)){
            Spawner.process(cluster);
        }

        Controller.control(cluster);
    });


    // if(Game.interval(20)){
        //TODO fix production to not rely on catalog
    //     Production.process();
    // }
    
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