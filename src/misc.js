"use strict";

var memoryVersion = 1;
var Util = require('./util');

class Misc {
    static updateStats(catalog){
        _.forEach(Memory.stats.profile.misc, (stat, name) => console.log('P:', name, 'avg:', stat));
        console.log('bucket:', Game.cpu.bucket);
        var stats = {
            rooms: {},
            profile: {
                misc: {},
                miscCount: {}
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
                energy: catalog.getResource(room.storage, RESOURCE_ENERGY)
            };
            totalRepair += repairHits;
            totalBuild += buildHits;
        });
        var energyList = _.map(catalog.buildings.storage, 'store.energy');
        stats.global = {
            maxSpawn: _.max(_.map(stats.rooms, 'spawn')),
            totalEnergy: _.sum(energyList),
            energySpread: _.min(energyList) / _.max(energyList),
            build: totalBuild,
            repair: totalRepair
        }
        var baseResources = _.filter(RESOURCES_ALL, res => res.length == 1 || res.startsWith('X'));
        baseResources.push('UO');
        stats.minerals = _.zipObject(baseResources, _.map(baseResources, res => catalog.resources[res].total));
        Memory.stats = stats;
        Misc.updateSettings(catalog);
    }

    static updateSettings(catalog){
        Memory.settings.mineralLimit = Memory.settings.terminalIdealResources * _.size(catalog.buildings.terminal) + 25000 * _.size(catalog.buildings.storage) + 100000;
        Memory.limits.mineral = _.filter(Memory.limits.mineral, mineral => catalog.resources[mineral].total > Memory.settings.mineralLimit - 20000);
        _.forEach(catalog.resources, (data, type)=>{
            if(type != RESOURCE_ENERGY && data.total > Memory.settings.mineralLimit && !_.includes(Memory.limits.mineral, type)){
                Memory.limits.mineral.push(type);
                console.log('Banning:', type, '-', Memory.limits.mineral, data.total);
            }
        });
        if(Memory.stats.global.repair < 500000 && Memory.stats.global.totalEnergy > 250000 + 100000 * _.size(catalog.buildings.storage)){
            Memory.settings.repairTarget = Memory.settings.repairTarget + 1000;
            console.log('Expanding repairTarget', Memory.settings.repairTarget);
            Game.notify('Expanding repairTarget: ' + Memory.settings.repairTarget);
        }
    }

    static miscUpdate(catalog){
        var keeps = _.map(catalog.getFlagsByPrefix('Keep'), 'pos.roomName');
        var pickup = catalog.getFlagsByPrefix('Pickup');
        var stockpile = _.reduce(Util.getObjects(Memory.stockpile), (result, stockpile) =>{
            var level = _.get(stockpile, 'room.controller.level', 0);
            var allocation = Math.min(3, Math.abs(level - 7));
            if(allocation > 0){
                _.set(result, stockpile.pos.roomName, _.get(result, stockpile.pos.roomName, 0) + allocation);
            }
            return result;
        }, {});
        // var repair = _.union(_.map(catalog.rooms, 'name'), _.map(catalog.getFlagsByPrefix('Repair'), 'pos.roomName'));
        Memory.roomlist = {
            keep: _.zipObject(keeps, _.map(keeps, roomName => Math.ceil(_.get(Memory.keeps, roomName, 0) / 2))),
            pickup: _.zipObject(_.map(pickup, 'pos.roomName'), _.map(pickup, flag => flag.room ? _.size(flag.room.find(FIND_SOURCES)) : 2)),
            // repair: _.zipObject(repair, new Array(repair.length).fill(1)),
            stockpile,
            spawn: _.zipObject(_.map(catalog.rooms, 'name'), new Array(catalog.rooms.length).fill(1))//_.map(catalog.rooms, room => _.size(room.find(FIND_MY_SPAWNS))))
        }
    }

    static initMemory(){
        if(Memory.memoryVersion != memoryVersion){
            console.log('Init memory version', memoryVersion);
            Memory.memoryVersion = memoryVersion;
            Memory.accessibility = {};
            Memory.jobs = {};
            Memory.jobUpdateTime = {};
            Memory.limits = {
                mineral: []
            };
            Memory.watch = {};
            Memory.cache = {
                accessibility: {},
                roompos: {}
            }
            Memory.uid = 1;
            Memory.updateTime = 0;
            Memory.production = {
                labs: [],
                boosts: {}
            };
            Memory.reaction = {};
            Memory.transfer = {
                lab: {},
                energy: {}
            };
            Memory.boost = {
                labs: {},
                stored: {}
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
            upgradeCapacity: 10,
            labIdealMinerals: 1500,
            terminalMaxResources: 100000,
            terminalIdealResources: 5000
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