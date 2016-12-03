var Controller = require('controller');
var Spawner = require('spawner');
var Behavior = require('behavior');
var Catalog = require('catalog');

class Util {
    static updateStats(catalog){
        var stats = {
            rooms: {}
        };
        _.forEach(Game.spawns, spawn => {
            var spawnCapacity = 0;
            var repairJobs = 0;
            var repairHits = 0;
            var buildHits = 0;
            _.forEach(spawn.room.find(FIND_STRUCTURES), structure => {
                if(structure.structureType == STRUCTURE_EXTENSION){
                    spawnCapacity += structure.energyCapacity;
                }
                if(structure.hits < structure.hitsMax && structure.hits < Memory.repairTarget){
                    repairJobs++;
                    repairHits += Math.min(structure.hitsMax, Memory.repairTarget) - structure.hits;
                }
            });
            var buildSites = spawn.room.find(FIND_MY_CONSTRUCTION_SITES);
            _.forEach(buildSites, site => buildHits += site.progressTotal - site.progress);
            spawnCapacity += spawn.energyCapacity;
            stats.rooms[spawn.room.name] = {
                spawn: spawnCapacity,
                repairHits,
                buildHits,
                repairJobs,
                buildJobs: buildSites.length
            };
        });
        Memory.stats = stats;
    }
}

module.exports.loop = function () {
    var catalog = new Catalog();

    if(Memory.updateTime < Game.time || !Memory.updateTime){
        Util.updateStats(catalog);
        Memory.updateTime = Game.time + 200;
    }

    Spawner.mourn();
    Spawner.spawn(catalog);
    Behavior.process(catalog);
    Controller.control(catalog);
}