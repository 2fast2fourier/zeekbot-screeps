"use strict";

var Startup = require('./startup');
var Poly = require('./poly');
var Traveller = require('./traveller');

module.exports.loop = function () {
    PathFinder.use(true);
    Startup.start();
    Game.profile('memory', Game.cpu.getUsed());
    
    Misc.mourn();

    Game.finishProfile();
    Game.profile('cpu', Game.cpu.getUsed());

    if(Game.cpu.bucket < 5000){
        Util.notify('cpubucket', 'CPU bucket under limit!');
    }
    if(Game.cpu.bucket < 600){
        Util.notify('cpubucketcrit', 'CPU bucket critical!');
    }
}