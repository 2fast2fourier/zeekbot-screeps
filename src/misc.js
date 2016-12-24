"use strict";

var RoomUtil = require('./roomutil');

class Misc {
    static updateStats(catalog){
        if(Memory.debugProfile && Memory.stats && Memory.stats.profile.count > 10){
            console.log('CPU (- a +):', Memory.stats.profile.min, Memory.stats.profile.avg, Memory.stats.profile.max);
            var nameAvg = "";
            var maxAvg = 0;
            var nameMax = "";
            var maxMax = 0;
            _.forEach(Memory.stats.profile.job, (job, name) =>{
                if(maxAvg < job.avg){
                    maxAvg = job.avg;
                    nameAvg = name;
                }
                if(maxMax < job.max){
                    maxMax = job.max;
                    nameMax = name;
                }
            });
            console.log('Jobs - avg:', nameAvg, maxAvg, 'max:', nameMax, maxMax);
        }
        var stats = {
            rooms: {},
            profile: {
                job: {},
                worker: {},
                spawner: {},
                avg: 0,
                count: 0,
                max: 0,
                min: Infinity
            }
        };
        _.forEach(Game.rooms, room => {
            var spawns = room.find(FIND_MY_SPAWNS);
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
            _.forEach(spawns, spawn => spawnCapacity += spawn.energyCapacity);
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
        stats.global = {
            maxSpawn: _.max(_.map(stats.rooms, 'spawn')),
            totalEnergy: _.sum(_.map(stats.rooms, 'energy'))
        }
        Memory.stats = stats;
    }

    static setSettings(){
        Memory.settings = {
            flagRange: {
                mine: 25,
                keep: 25,
                attack: 25
            },
            updateDelta: 100,
            towerRepairPercent: 0.8,
            transferStoreThreshold: 500,
            repairTarget: 250000,
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