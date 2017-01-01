"use strict";

var memoryVersion = 1;

class Misc {
    static updateStats(catalog){
        if(Memory.debugMisc === true){
            _.forEach(Memory.stats.profile.misc, (stat, name) => console.log('P:', name, 'avg:', stat))
        }else if(Memory.debugMisc){
            console.log('P: '+Memory.debugMisc+' avg:', Memory.stats.profile.misc[Memory.debugMisc]);
        }
        if(Memory.debugProfile && Memory.stats && Memory.stats.profile.count > 10){
            console.log('CPU (- a +):', Memory.stats.profile.min, Memory.stats.profile.avg, Memory.stats.profile.max);
        }
        var stats = {
            rooms: {},
            profile: {
                misc: {},
                miscCount: {},
                avg: 0,
                count: 0,
                max: 0,
                min: Infinity
            }
        };
        var totalBuild = 0;
        var totalRepair = 0;
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
                if(structure.hits < Math.min(structure.hitsMax, Memory.settings.repairTarget)){
                    repairJobs++;
                    repairHits += Math.min(structure.hitsMax, Memory.settings.repairTarget) - structure.hits;
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
                energy: catalog.getResource(room.storage, RESOURCE_ENERGY),
                terminalEnergy: catalog.getResource(_.first(catalog.getStructuresByType(room, STRUCTURE_TERMINAL)), RESOURCE_ENERGY),
                upgradeDistance: _.min(_.map(room.find(FIND_SOURCES), source => source.pos.getRangeTo(room.controller)))
            };
            totalRepair += repairHits;
            totalBuild += buildHits;
        });
        stats.global = {
            maxSpawn: _.max(_.map(stats.rooms, 'spawn')),
            totalEnergy: _.sum(_.map(stats.rooms, 'energy')),
            build: totalBuild,
            repair: totalRepair,
            upgrade: {
                XUHO2: 50
            }
        }
        Memory.stats = stats;
    }

    static initMemory(){
        if(Memory.memoryVersion != memoryVersion){
            console.log('Init memory version', memoryVersion);
            Memory.memoryVersion = memoryVersion;
            Memory.accessibility = {};
            Memory.jobs = {};
            Memory.jobUpdateTime = {};
            Memory.uid = 1;
            Memory.updateTime = 0;
            Memory.production = {
                labs: [],
                quota: {}
            };
            Memory.transfer = {
                lab: {},
                energy: {}
            };
        }
    }

    static setSettings(){
        Memory.settings = {
            flagRange: {
                mine: 25,
                keep: 25,
                attack: 25
            },
            updateDelta: 100,
            productionOverhead: 100,
            towerRepairPercent: 0.8,
            transferStoreThreshold: 500,
            transferRefillThreshold: 500,
            repairTarget: 250000,
            upgradeCapacity: 15,
            terminalMaxResources: 100000
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