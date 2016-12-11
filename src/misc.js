"use strict";

var RoomUtil = require('./roomutil');

class Misc {
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
                extractor: catalog.getStructuresByType(room, STRUCTURE_EXTRACTOR).length > 0,
                mineralId: _.get(mineral, 'id', false),
                mineralType: _.get(mineral, 'mineralType', false),
                mineralAmount: _.get(mineral, 'mineralAmount', 0),
                energy: RoomUtil.getEnergy(room.storage),
                terminalEnergy: RoomUtil.getEnergy(_.first(catalog.getStructuresByType(room, STRUCTURE_TERMINAL))),
                upgradeDistance: _.min(_.map(room.find(FIND_SOURCES), source => source.pos.getRangeTo(room.controller)))
            };
        });
        Memory.stats = stats;
    }

    static setSettings(){
        Memory.settings = {
            updateDelta: 100,
            towerRepairPercent: 0.8,
            repairTarget: 25000,
            upgradeCapacity: 10
        };
    }

    static mourn(){
        for(var name in Memory.creeps) {
            if(!Game.creeps[name]) {
                delete Memory.creeps[name];
            }
        }
    }
}

module.exports = Misc;