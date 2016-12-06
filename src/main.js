"use strict";

var Controller = require('./controller');
var Spawner = require('./spawner');
var Behavior = require('./behavior');
var Catalog = require('./catalog');
var RoomUtil = require('./roomutil');

class Util {
    static updateStats(catalog){
        var stats = {
            rooms: {}
        };
        _.forEach(Game.spawns, spawn => {
            var room = spawn.room;
            var spawnCapacity = 0;
            var repairJobs = 0;
            var repairHits = 0;
            var buildHits = 0;
            _.forEach(room.find(FIND_STRUCTURES), structure => {
                if(structure.structureType == STRUCTURE_EXTENSION){
                    spawnCapacity += structure.energyCapacity;
                }
                if(structure.hits < structure.hitsMax && structure.hits < Memory.repairTarget){
                    repairJobs++;
                    repairHits += Math.min(structure.hitsMax, Memory.repairTarget) - structure.hits;
                }
            });
            var buildSites = room.find(FIND_MY_CONSTRUCTION_SITES);
            var mineral = _.first(room.find(FIND_MINERALS));
            _.forEach(buildSites, site => buildHits += site.progressTotal - site.progress);
            spawnCapacity += spawn.energyCapacity;
            stats.rooms[room.name] = {
                spawn: spawnCapacity,
                repairHits,
                buildHits,
                repairJobs,
                buildJobs: buildSites.length,
                extractor: catalog.getBuildingsByType(room, STRUCTURE_EXTRACTOR).length > 0,
                mineralId: _.get(mineral, 'id', false),
                mineralType: _.get(mineral, 'mineralType', false),
                energy: RoomUtil.getEnergy(room.storage),
                terminalEnergy: RoomUtil.getEnergy(catalog.getFirstBuilding(room, STRUCTURE_TERMINAL)),
                upgradeDistance: _.min(_.map(room.find(FIND_SOURCES), source => source.pos.getRangeTo(room.controller)))
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

    if(!Memory.settings){
        Memory.settings = {
            towerRepairPercent: 0.1
        };
    }

    Spawner.mourn();
    Spawner.spawn(catalog);
    Behavior.process(catalog);
    Controller.control(catalog);
}