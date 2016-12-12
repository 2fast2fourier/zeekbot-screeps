module.exports =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var Controller = __webpack_require__(1);
	var Spawner = __webpack_require__(3);
	var WorkManager = __webpack_require__(5);
	var Catalog = __webpack_require__(18);
	var Misc = __webpack_require__(30);

	module.exports.loop = function () {
	    if(!Memory.settings){
	        Misc.setSettings();
	    }

	    Misc.mourn();

	    var catalog = new Catalog();

	    if(Memory.updateTime < Game.time || !Memory.updateTime){
	        Misc.updateStats(catalog);
	        Memory.updateTime = Game.time + Memory.settings.updateDelta;
	    }

	    catalog.jobs.generate();
	    catalog.jobs.allocate();
	    // _.forEach(catalog.jobs.jobs['upgrade'], (upgrade, id)=>console.log(id, upgrade, upgrade.allocated));
	    WorkManager.process(catalog);
	    Spawner.spawn(catalog);
	    Controller.control(catalog);
	}

/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var RoomUtil = __webpack_require__(2);

	class Controller {

	    static control(catalog){
	        var towers = _.filter(Game.structures, {structureType: STRUCTURE_TOWER});
	        towers.forEach(tower => {
	            if(!Memory.standDown && !Controller.towerDefend(tower, catalog)){
	                if(!Controller.towerHeal(tower, catalog) && tower.energy > tower.energyCapacity * 0.75){
	                    Controller.towerRepair(tower, catalog)
	                }
	            }
	        });

	        _.forEach(Memory.linkTransfer, (target, source) => Controller.linkTransfer(Game.getObjectById(source), Game.getObjectById(target)));
	    }

	    static towerDefend(tower, catalog) {
	        var hostiles = catalog.getHostileCreeps(tower.room);
	        var healer = _.first(hostiles, creep => !!_.find(creep.body, part => part.type == HEAL));
	        if(healer){
	            return tower.attack(healer) == OK;
	        }
	        if(hostiles.length > 0) {
	            var enemies = _.sortBy(hostiles, (target)=>tower.pos.getRangeTo(target));
	            return tower.attack(enemies[0]) == OK;
	        }
	        return false;
	    }

	    static towerHeal(tower, catalog) {
	        var injuredCreeps = _.filter(catalog.getCreeps(tower.room), creep => creep.hits < creep.hitsMax);
	        if(injuredCreeps.length > 0) {
	            var injuries = _.sortBy(injuredCreeps, creep => creep.hits / creep.hitsMax);
	            return tower.heal(injuries[0]) == OK;
	        }
	        return false;
	    }

	    static towerRepair(tower, catalog) {
	        var damagedBuildings = _.filter(catalog.getStructures(tower.room), structure => structure.hits < Math.min(structure.hitsMax, Memory.repairTarget) * Memory.settings.towerRepairPercent);
	        if(damagedBuildings.length > 0) {
	            var damaged = _.sortBy(damagedBuildings, structure => structure.hits / Math.min(structure.hitsMax, Memory.repairTarget));
	            tower.repair(damaged[0]);
	        }
	    }

	    static linkTransfer(source, target){
	        var need = RoomUtil.getEnergyDeficit(target);
	        if(source && need >= 50 && source.cooldown == 0 && need > 0 && RoomUtil.getEnergy(source) > 0){
	            source.transferEnergy(target, Math.min(RoomUtil.getEnergy(source), need));
	        }
	    }
	}

	module.exports = Controller;

/***/ },
/* 2 */
/***/ function(module, exports) {

	"use strict";

	class RoomUtil {

	    static getStats(room){
	        return _.get(Memory.stats.rooms, room.name, false);
	    }

	    static getStat(room, stat, fallback){
	        return _.get(Memory.stats.rooms, [room.name, stat], fallback);
	    }

	    static exists(id){
	        return id != null && id != false && Game.getObjectById(id) != null;
	    }

	    static prioritizeSources(room){
	        var sources = room.find(FIND_SOURCES);
	        var currentHarvesters = room.find(FIND_MY_CREEPS, {
	            filter: (creep)=>!!creep.memory.traits.mining || !!creep.memory.lastSource
	        });
	        var usage = _.countBy(currentHarvesters, function(harv){
	            return harv.memory.lastSource || harv.memory.traits.mining;
	        });
	        var leastId = sources[0].id;
	        var leastCount = _.get(usage, sources[0].id, 0);
	        _.forEach(sources, function(source){
	            if(!usage[source.id] || leastCount > usage[source.id]){
	                leastId = source.id;
	                leastCount = usage[source.id] || 0;
	            }
	        });
	        return leastId;
	    }

	    static getNearestSource(creep, maxRange){
	        if(maxRange > 0){
	            var sources = _.filter(creep.room.find(FIND_SOURCES), source => creep.pos.getRangeTo(source) <= maxRange);
	            return _.first(_.sortBy(sources, source => creep.pos.getRangeTo(source)));
	        }else{
	            return _.first(_.sortBy(creep.room.find(FIND_SOURCES), source => creep.pos.getRangeTo(source) <= maxRange));
	        }
	    }

	    static calculateSourceEnergy(room){
	        var energy = 0;
	        var sources = room.find(FIND_SOURCES);
	        _.forEach(sources, source => energy += source.energy);
	        return energy;
	    }

	    static onEdge(pos){
	        return pos.x < 1 || pos.x > 48 || pos.y < 1 || pos.y > 48;
	    }

	    static energyFull(entity){
	        return !(RoomUtil.getEnergy(entity) < RoomUtil.getEnergyCapacity(entity));
	    }
	    
	    static getStorage(entity){
	        if(!entity){
	            return 0;
	        }
	        if(entity.carryCapacity > 0){
	            return _.sum(entity.carry);
	        }else if(entity.storeCapacity > 0){
	            return _.sum(entity.store);
	        }else if(entity.energyCapacity > 0){
	            return entity.energy;
	        }else if(entity.resourceType && entity.resourceType == RESOURCE_ENERGY && entity.amount > 0){
	            return entity.amount;
	        }
	        return 0;
	    }

	    static getStorageCapacity(entity){
	        if(!entity){
	            return 0;
	        }
	        if(entity.carryCapacity > 0){
	            return entity.carryCapacity;
	        }else if(entity.storeCapacity > 0){
	            return entity.storeCapacity;
	        }else if(entity.energyCapacity > 0){
	            return entity.energyCapacity;
	        }else if(entity.resourceType && entity.amount > 0){
	            return entity.amount;
	        }
	        return 0;
	    }

	    static getStoragePercent(entity){
	        return RoomUtil.getStorage(entity) / RoomUtil.getStorageCapacity(entity);
	    }

	    static getEnergyPercent(entity){
	        if(!entity){
	            return 0;
	        }
	        if(entity.carryCapacity > 0){
	            return entity.carry.energy / entity.carryCapacity;
	        }else if(entity.storeCapacity > 0){
	            return entity.store[RESOURCE_ENERGY] / entity.storeCapacity;
	        }else if(entity.energyCapacity > 0){
	            return entity.energy / entity.energyCapacity;
	        }else if(entity.resourceType && entity.resourceType == RESOURCE_ENERGY && entity.amount > 0){
	            return Math.min(entity.amount, 1);
	        }
	        return 0;
	    }

	    static getResource(entity, type){
	        if(!entity){
	            return 0;
	        }
	        if(entity.carryCapacity > 0){
	            return entity.carry[type];
	        }else if(entity.storeCapacity > 0){
	            return entity.store[type];
	        }else if(entity.energyCapacity > 0 && type === RESOURCE_ENERGY){
	            return entity.energy;
	        }else if(entity.resourceType && entity.resourceType == type && entity.amount > 0){
	            return entity.amount;
	        }
	        return 0;
	    }

	    static getEnergy(entity){
	        if(!entity){
	            return 0;
	        }
	        if(entity.carryCapacity > 0){
	            return entity.carry.energy;
	        }else if(entity.storeCapacity > 0){
	            return entity.store[RESOURCE_ENERGY];
	        }else if(entity.energyCapacity > 0){
	            return entity.energy;
	        }else if(entity.resourceType && entity.resourceType == RESOURCE_ENERGY && entity.amount > 0){
	            return entity.amount;
	        }
	        return 0;
	    }

	    static getEnergyCapacity(entity){
	        if(!entity){
	            return 0;
	        }
	        if(entity.carryCapacity > 0){
	            return entity.carryCapacity;
	        }else if(entity.storeCapacity > 0){
	            return entity.storeCapacity;
	        }else if(entity.energyCapacity > 0){
	            return entity.energyCapacity;
	        }else if(entity.resourceType && entity.resourceType == RESOURCE_ENERGY && entity.amount > 0){
	            return entity.amount;
	        }
	        return 0;
	    }

	    static getEnergyDeficit(entity){
	        return RoomUtil.getEnergyCapacity(entity) - RoomUtil.getEnergy(entity);
	    }

	    static getStorageDeficit(entity){
	        return RoomUtil.getStorageCapacity(entity) - RoomUtil.getStorage(entity);
	    }

	    static findEnergyNeeds(room, creep, ignoreContainers){
	        var needs;
	        if(ignoreContainers){
	            needs = room.find(FIND_STRUCTURES, {
	                    filter: (structure) => {
	                        return (structure.structureType == STRUCTURE_EXTENSION ||
	                                structure.structureType == STRUCTURE_SPAWN ||
	                                structure.structureType == STRUCTURE_TOWER) &&
	                            RoomUtil.getEnergyPercent(structure) < 1;
	                    }
	            });
	        }else{
	            needs = room.find(FIND_STRUCTURES, {
	                    filter: (structure) => {
	                        return (structure.structureType == STRUCTURE_EXTENSION ||
	                                structure.structureType == STRUCTURE_SPAWN ||
	                                structure.structureType == STRUCTURE_TOWER ||
	                                structure.structureType == STRUCTURE_CONTAINER) &&
	                            RoomUtil.getEnergyPercent(structure) < 1;
	                    }
	            });
	        }
	        if(creep){
	            needs = _.sortBy(needs, (target)=>creep.pos.getRangeTo(target));
	        }
	        return needs;
	    }
	    
	    static getEnergyPriority(type){
	        if(!type){
	            return 1;
	        }
	        var priorities = {
	            'spawn': 0.5,
	            'extension': 1.25,
	            'tower': -1,
	            'container': 1.5,
	            'storage': 10,
	            'link': 1.5
	        };
	        return _.get(priorities, type, 1);
	    }

	    static findFreeMiningId(room, creep, catalog){
	        //TODO balance, find max capacity, ect
	        return RoomUtil.prioritizeSources(room);
	    }
	}

	module.exports = RoomUtil;

/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var classConfig = __webpack_require__(4);
	// var behaviors = require('./behaviors');

	class Spawner {

	    static partList(args){
	        var parts = [];
	        _.forEach(args, (count, name)=>{
	            for(var iy=0;iy<count;iy++){
	                parts.push(name);
	            }
	        });
	        return parts;
	    }

	    static calculateCost(partList){
	        var prices = { work: 100, carry: 50, move: 50, attack: 80, tough: 10, ranged_attack: 150, claim: 600, heal: 250 };
	        var cost = 0;
	        _.forEach(partList, (count, name)=>{
	            cost += prices[name] * count;
	        });
	        return cost;
	    }

	    static shouldSpawn(spawn, fullType, className, version, catalog, category, roomStats){
	        if(!Spawner.checkRequirements(spawn, catalog, category, version, roomStats) ||
	            Spawner.checkDisable(spawn, catalog, category, version, roomStats)){
	            return false;
	        }
	        return Spawner.getSpawnCount(spawn, catalog, category, version, roomStats, className, fullType) > 0;
	    }

	    static getSpawnCount(spawn, catalog, category, version, roomStats, className, fullType){
	        var currentCount = Spawner.getCount(catalog, fullType);
	        var additional = Spawner.calculateAdditional(category, version, catalog, roomStats);
	        var ideal = _.get(version, 'ideal', 0);
	        var bootstrap = _.get(version, 'bootstrap', 0);
	        var quota = version.quota || category.quota;

	        if(quota && quota.jobType && version.quota !== false){
	            var needCapacity = _.get(catalog.jobs.capacity, quota.jobType, 0);
	            var targetCapacity = needCapacity * _.get(quota, 'ratio', 1);
	            var creepsNeeded = Math.ceil(targetCapacity/_.get(version, 'allocation', _.get(quota, 'allocation', 1)));
	            additional += Math.min(creepsNeeded, _.get(quota, 'max', Infinity));
	        }

	        if(ideal > 0){
	            return Math.max(0, ideal + additional - currentCount);
	        }else if(bootstrap > 0){
	            return Math.max(0, bootstrap + additional - Spawner.getClassCount(catalog, className));
	        }else if(additional > 0){
	            return Math.max(0, additional - currentCount);
	        }
	        return 0;
	    }

	    static calculateAdditional(config, version, catalog, roomStats){
	        var count = 0;
	        var additional = version.additional || config.additional;

	        //TODO nuke this
	        var additionalPer = version.additionalPer || config.additionalPer;
	        if(additionalPer){
	            if(additionalPer.flagPrefix){
	                count += catalog.getFlagsByPrefix(additionalPer.flagPrefix).length;
	            }
	            if(additionalPer.room > 0){
	                count += catalog.rooms.length * additionalPer.room;
	            }
	        }
	        //END TODO

	        if(additional){
	            var pass = _.reduce(additional, (result, requirement, name)=>{
	                if(name == 'count' || name == 'unless'){
	                    return result;
	                }
	                return result && roomStats[name] > requirement;
	            }, true);
	            if(pass){
	                count += _.get(additional, 'count', 0);
	            }else{
	                count += _.get(additional, 'unless', 0);
	            }
	        }
	        return count;
	    }

	    static checkRequirements(spawn, catalog, category, version, roomStats){
	        var requirements = version.requirements;
	        if(requirements){
	            if(requirements.extractor && !roomStats.extractor){
	                return false;
	            }
	            if(requirements.mineralAmount > 0 && roomStats.mineralAmount < requirements.mineralAmount){
	                return false
	            }
	            if(requirements.energy > 0 && roomStats.energy < requirements.energy){
	                return false;
	            }
	            if(requirements.flag && !Game.flags[requirements.flag]){
	                return false;
	            }
	            if(requirements.repairHits > 0 && requirements.repairHits > roomStats.repairHits){
	                return false;
	            }
	            if(requirements.flagClear > 0 && !!Game.flags[requirements.flag]){
	                var flag = Game.flags[requirements.flag];
	                if(!flag.room){
	                    return false;
	                }
	                var hostiles = _.filter(catalog.getHostileCreeps(flag.room), hostile => flag.pos.getRangeTo(hostile) < requirements.flagClear);
	                if(hostiles.length > 0){
	                    return false;
	                }
	            }
	        }
	        return true;
	    }

	    static checkDisable(spawn, catalog, category, version, roomStats){
	        var disable = version.disable;
	        if(disable){
	            if(disable.maxSpawn > 0 && Memory.stats.global.maxSpawn >= disable.maxSpawn){
	                return true;
	            }
	            if(disable.extractor && roomStats.extractor){
	                return true;
	            }
	            if(disable.energy > 0 && roomStats.energy >= disable.energy){
	                return true;
	            }
	            if(disable.flag && !!Game.flags[disable.flag]){
	                return true;
	            }
	            if(disable.terminalEnergy > 0 && disable.terminalEnergy <= roomStats.terminalEnergy){
	                return true;
	            }
	        }
	        return false;
	    }

	    static findCriticalDeficit(spawn, catalog){
	        var roomStats = Memory.stats.rooms[spawn.room.name];
	        var deficits = {};
	        var deficitCount = {};
	        _.forEach(classConfig, (config, className) => {
	            _.forEach(config.versions, (version, typeName) =>{
	                if(version.critical > 0
	                        && version.critical <= roomStats.spawn
	                        && Spawner.checkRequirements(spawn, catalog, config, version, roomStats)
	                        && !Spawner.checkDisable(spawn, catalog, config, version, roomStats)){
	                    var count = Spawner.getSpawnCount(spawn, catalog, config, version, roomStats, className, typeName+className);
	                    if(count > 0 && !spawn.spawning){
	                        deficits[className] = config;
	                        deficitCount[className] = count;
	                    }
	                }
	            });
	        });
	        catalog.spawnDeficit = deficitCount;
	        return deficits;
	    }

	    static prepareSpawnMemory(category, version, fullType, className, versionName, catalog, spawn){
	        var memory = {
	            class: className,
	            type: fullType,
	            version: versionName,
	            jobId: false,
	            jobType: false,
	            jobAllocation: 0,
	            rules: version.rules || category.rules
	        };

	        return memory;
	    }

	    static getCount(catalog, fullType){
	        return _.get(catalog.creeps.type, [fullType, 'length'], 0);
	    }

	    static getClassCount(catalog, classType){
	        return _.get(catalog.creeps.class, [classType, 'length'], 0);
	    }

	    static processSpawn(spawn, catalog, startedSpawn){
	        var config = classConfig;
	        var deficits = Spawner.findCriticalDeficit(spawn, catalog);
	        var roomStats = Memory.stats.rooms[spawn.room.name];
	        if(!roomStats){
	            Memory.updateTime = 0;
	            return;
	        }
	        if(_.size(deficits) > 0){
	            config = deficits;
	        }
	        _.forEach(config, function(category, className){
	            _.forEach(category.versions, function(version, prefix){
	                var fullType = prefix + className;
	                if(!startedSpawn && !spawn.spawning && Spawner.shouldSpawn(spawn, fullType, className, version, catalog, category, roomStats)){
	                    var loadout = Spawner.partList(version.parts);
	                    if(spawn.canCreateCreep(loadout) == OK){
	                        var spawned = spawn.createCreep(loadout, fullType+'-'+Memory.uid, Spawner.prepareSpawnMemory(category, version, fullType, className, prefix, catalog, spawn));
	                        startedSpawn = !!spawned;
	                        Memory.uid++;
	                        console.log(spawn.name, 'spawning', fullType, 'new count:', Spawner.getCount(catalog, fullType)+1, 'cost:', Spawner.calculateCost(version.parts));
	                        //HACK reset deficit count until next tick, so we don't accidentally interrupt any jobs
	                        catalog.deficits[className] = 0;
	                    }
	                }
	            });
	        });
	        return startedSpawn;
	    }

	    static spawn(catalog){
	        if(!Memory.uid){
	            Memory.uid = 1;
	        }
	        if(Memory.resetBehavior){
	            Spawner.resetBehavior(catalog);
	        }
	        var spawned = false;
	        _.forEach(Game.spawns, spawn => {
	            spawned = Spawner.processSpawn(spawn, catalog, spawned);
	        });
	    }

	    static resetBehavior(catalog){
	        _.forEach(Game.creeps, creep=>{
	            var config = _.get(classConfig, creep.memory.class, false);
	            var version = _.get(config, ['versions', creep.memory.version], false);
	            if(!config || !version){
	                console.log('could not find config', creep);
	                return;
	            }
	            creep.memory.rules = version.rules || config.rules;
	            creep.memory.jobId = false;
	            creep.memory.jobType = false;
	            creep.memory.jobAllocation = 0;
	        });
	        Memory.resetBehavior = false;
	        console.log("Reset behavior!");
	    }
	}


	module.exports = Spawner;

/***/ },
/* 4 */
/***/ function(module, exports) {

	"use strict";

	module.exports = {
	    miner: {
	        versions: {
	            milli: {
	                allocation: 6,
	                critical: 900,
	                parts: {work: 6, carry: 2, move: 4}
	            },
	            micro: {
	                allocation: 6,
	                critical: 750,
	                disable: {
	                    maxSpawn: 900
	                },
	                parts: {work: 6, carry: 2, move: 1}
	            },
	            nano: {
	                allocation: 4,
	                critical: 550,
	                disable: {
	                    maxSpawn: 750
	                },
	                parts: {work: 4, carry: 2, move: 1}
	            },
	            // pico: {
	            //     bootstrap: 1,
	            //     quota: false,
	            //     critical: 300,
	            //     parts: {work: 2, carry: 1, move: 1},
	            //     disable: {
	            //         energy: 2000
	            //     },
	            //     additional: {
	            //         unless: 5,
	            //         spawn: 500
	            //     }
	            // }
	        },
	        quota: {
	            jobType: 'mine',
	            ratio: 1
	        },
	        rules: {
	            mine: {},
	            deliver: { maxRange: 2, ignoreCreeps: true, types: [ STRUCTURE_STORAGE, STRUCTURE_CONTAINER, STRUCTURE_TOWER ] },
	            drop: { priority: 1 }
	        }
	    },
	    hauler: {
	        versions: {
	            spawn: {
	                ideal: 2,
	                critical: 600,
	                parts: {carry: 6, move: 6},
	                additionalPer: {
	                    room: 1
	                },
	                rules: {
	                    pickup: {},
	                    deliver: { types: [ STRUCTURE_SPAWN, STRUCTURE_EXTENSION ], ignoreCreeps: true }
	                }
	            },
	            picospawn: {
	                bootstrap: 1,
	                critical: 300,
	                // disable: {
	                //     maxSpawn: 600
	                // },
	                parts: {carry: 3, move: 3},
	                rules: {
	                    pickup: {},
	                    deliver: { types: [ STRUCTURE_SPAWN, STRUCTURE_EXTENSION ], ignoreCreeps: true }
	                }
	            },
	            micro: {
	                ideal: 1,
	                additionalPer: {
	                    room: 1
	                },
	                parts: {carry: 6, move: 6}
	            },
	            nano: {
	                ideal: 2,
	                disable: {
	                    maxSpawn: 1400
	                },
	                parts: {carry: 5, move: 5}
	            },
	            pico: {
	                bootstrap: 1,
	                parts: {carry: 2, move: 2}
	            }
	        },
	        rules: {
	            pickup: {},
	            deliver: {}
	        }
	    },
	    worker: {
	        versions: {
	            milli: {
	                ideal: 1,
	                additionalPer: {
	                    room: 1
	                },
	                parts: {work: 6, carry: 2, move: 8}
	            },
	            micro: {
	                ideal: 2,
	                disable: {
	                    maxSpawn: 1400
	                },
	                parts: {work: 4, carry: 2, move: 6}
	            },
	            nano: {
	                ideal: 2,
	                disable: {
	                    maxSpawn: 800
	                },
	                parts: {work: 2, carry: 2, move: 4}
	            },
	            pico: {
	                bootstrap: 1,
	                // disable: {
	                //     maxSpawn: 500
	                // },
	                parts: {work: 1, carry: 2, move: 2}
	            },
	            upgrade: {
	                quota: {
	                    jobType: 'upgrade',
	                    allocation: 5,
	                    ratio: 1
	                },
	                parts: {work: 5, carry: 2, move: 7},
	                rules: { pickup: {}, upgrade: {} }
	            }
	        },
	        rules: {
	            pickup: {},
	            build: {},
	            repair: {},
	            upgrade: { priority: 1 }
	        }
	    },
	    observer: {
	        versions: {
	            pico: {
	                ideal: 0,
	                quota: {
	                    jobType: 'observe',
	                    allocation: 1,
	                    ratio: 1
	                },
	                parts: {tough: 1, move: 1}
	            },
	        },
	        rules: { observe: {} }
	    },
	    claimer: {
	        versions: {
	            pico: {
	                parts: {claim: 2, move: 2}
	            },
	        },
	        quota: {
	            jobType: 'reserve',
	            allocation: 2,
	            ratio: 1
	        },
	        rules: { reserve: {} }
	    }
	};

/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var Work = __webpack_require__(6);

	class WorkManager {
	    static process(catalog){
	        var workers = Work(catalog);
	        var creeps = _.filter(Game.creeps, creep => !creep.spawning);
	        _.forEach(creeps, creep => WorkManager.validateCreep(creep, workers, catalog));
	        _.forEach(creeps, creep => WorkManager.bidCreep(creep, workers, catalog));
	        _.forEach(creeps, creep => WorkManager.processCreep(creep, workers, catalog));
	    }

	    static validateCreep(creep, workers, catalog){
	        if(creep.memory.jobType){
	            if(!workers[creep.memory.jobType].stillValid(creep, creep.memory.rules[creep.memory.jobType])){
	                workers[creep.memory.jobType].stop(creep, creep.memory.rules[creep.memory.jobType]);
	                creep.memory.jobId = false;
	                creep.memory.jobType = false;
	                creep.memory.jobAllocation = 0;
	            }
	        }
	    }

	    static bidCreep(creep, workers, catalog){
	        if(!creep.memory.jobType){
	            var lowestBid = 99999999;
	            var bidder = _.reduce(creep.memory.rules, (result, rule, type) => {
	                if(!workers[type]){
	                    console.log('missing worker', type);
	                    return result;
	                }
	                var bid = workers[type].bid(creep, rule);
	                if(bid !== false && bid.bid < lowestBid){
	                    lowestBid = bid.bid;
	                    return bid;
	                }
	                return result;
	            }, false);

	            if(bidder !== false){
	                creep.memory.jobId = _.get(bidder, 'job.id', false);
	                creep.memory.jobType = bidder.type;
	                creep.memory.jobAllocation = _.get(bidder, 'allocation', 0);
	                catalog.jobs.addAllocation(creep.memory.jobType, creep.memory.jobId, creep.memory.jobAllocation);
	                workers[creep.memory.jobType].start(creep, bidder, creep.memory.rules[creep.memory.jobType]);
	                if(workers[creep.memory.jobType].debug){
	                    console.log(creep.memory.jobType, creep, bidder.job.target);
	                }
	            }
	        }
	    }

	    static processCreep(creep, workers, catalog){
	        if(creep.memory.jobType){
	            workers[creep.memory.jobType].process(creep, creep.memory.rules[creep.memory.jobType]);
	        }
	    }
	}

	module.exports = WorkManager;

/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var Build = __webpack_require__(7);
	var Deliver = __webpack_require__(10);
	var Drop = __webpack_require__(11);
	// var Heal = require('./heal');
	var Mine = __webpack_require__(12);
	var Observe = __webpack_require__(13);
	var Pickup = __webpack_require__(14);
	var Repair = __webpack_require__(15);
	var Reserve = __webpack_require__(16);
	var Upgrade = __webpack_require__(17);

	module.exports = function(catalog){
	    return {
	        build: new Build(catalog),
	        deliver: new Deliver(catalog),
	        drop: new Drop(catalog),
	        mine: new Mine(catalog),
	        observe: new Observe(catalog),
	        pickup: new Pickup(catalog),
	        repair: new Repair(catalog),
	        reserve: new Reserve(catalog),
	        upgrade: new Upgrade(catalog)
	    };
	};

/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(8);

	class BuildWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'build', { requiresEnergy: true, chatty: true }); }

	    calculateAllocation(creep, opts){
	        if(creep.getActiveBodyparts(WORK) > 0){
	            return this.catalog.getResource(creep, RESOURCE_ENERGY)/5;
	        }
	        return 0;
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        return this.getEnergyOffset(creep) + distance / this.distanceWeight;
	    }

	    processStep(creep, job, target, opts){
	        var result = creep.build(target);
	        if(result == ERR_NOT_IN_RANGE){
	            creep.moveTo(target);
	        }else if(result == ERR_INVALID_TARGET){
	            creep.move(Math.ceil(Math.random()*8));
	        }
	    }

	}

	module.exports = BuildWorker;

/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var SimpleWorker = __webpack_require__(9);

	class BaseWorker extends SimpleWorker {
	    constructor(catalog, type, opts){
	        super(catalog, type, opts);
	    }

	    getOpenJobs(){
	        return this.catalog.jobs.getOpenJobs(this.type);
	    }

	    getCurrentJob(creep){
	        if(creep.memory.jobType !== this.type){
	            return false;
	        }
	        return this.catalog.jobs.getJob(this.type, creep.memory.jobId);
	    }

	    getTarget(creep){
	        return _.get(this.getCurrentJob(creep), 'target', false);
	    }

	    getJobDistance(creep, job){
	        return Math.min(creep.pos.getRangeTo(job.target), 99);
	    }

	    calcAvailRatio(job, allocation){
	        return 1 - Math.min(1, Math.max(0, job.capacity - job.allocated)/allocation);
	    }

	    stillValid(creep, opts){
	        var job = this.getCurrentJob(creep);
	        return job && job.target && this.isValid(creep, opts, job, job.target);
	    }

	    isValid(creep, opts, job, target){
	        return super.stillValid(creep, opts);
	    }

	    canBid(creep, opts){
	        if(this.requiresEnergy){
	            return this.catalog.getResource(creep, RESOURCE_ENERGY) > 0;
	        }
	        return true;
	    }

	    bid(creep, opts){
	        if(!this.canBid(creep, opts)){
	            return false;
	        }
	        var lowestBid = 99999999;
	        var allocation = this.calculateAllocation(creep, opts);
	        if(!allocation){
	            return false;
	        }
	        var jobs = this.getOpenJobs();
	        return _.reduce(jobs, (result, job) =>{
	            var distance = this.getJobDistance(creep, job);
	            if(opts.maxRange > 0 && distance > opts.maxRange){
	                return result;
	            }
	            var bid = this.calculateBid(creep, opts, job, allocation, distance);
	            if(bid !== false){
	                bid += _.get(opts, 'priority', 0);
	                if(bid < lowestBid){
	                    lowestBid = bid;
	                    return { allocation, bid, job, type: this.type };
	                }
	            }
	            return result;
	        }, false);
	    }

	    calculateAllocation(creep, opts){ console.log('calculateAllocation not implemented', this.type); }

	    calculateBid(creep, opts, job, allocation){ console.log('calculateBid not implemented', this.type); }
	    
	    process(creep, opts){
	        var job = this.getCurrentJob(creep);
	        if(!job || !job.target){
	            return;
	        }
	        this.processStep(creep, job, job.target, opts);
	    }

	    processStep(creep, job, target, opts){ console.log('processStep not implemented', this.type); }

	}

	module.exports = BaseWorker;

/***/ },
/* 9 */
/***/ function(module, exports) {

	"use strict";

	class SimpleWorker {
	    constructor(catalog, type, opts){
	        this.catalog = catalog;
	        this.type = type;
	        this.distanceWeight = 50;
	        if(opts){
	            _.assign(this, opts);
	        }
	    }

	    getType(){
	        return this.type;
	    }

	    getEnergyOffset(creep){
	        return 1 - this.catalog.getResourcePercent(creep, RESOURCE_ENERGY);
	    }

	    getResourceOffset(creep, type){
	        return 1 - this.catalog.getResourcePercent(creep, type);
	    }

	    stillValid(creep, opts){
	        if(this.idleTimer > 0 && creep.memory.idleCheck > 0 && creep.memory.idleCheck < Game.time){
	            return false;
	        }
	        if(this.requiresEnergy){
	            return this.catalog.getResource(creep, RESOURCE_ENERGY) > 0;
	        }else{
	            return true;
	        }
	    }

	    bid(creep, opts){
	        if(this.requiresEnergy){
	            return this.catalog.getResource(creep, RESOURCE_ENERGY) > 0;
	        }
	        return true;
	    }
	    
	    start(creep, opts){
	        if(this.chatty){
	            creep.say(this.type);
	        }
	        if(this.debug){
	            console.log('start',this.type)
	        }
	        if(this.idleTimer > 0){
	            creep.memory.idleCheck = Game.time + this.idleTimer;
	        }
	    }
	    
	    process(creep, opts){ }
	    
	    stop(creep, bid, opts){
	        if(this.debug){
	            console.log('stop',this.type)
	        }
	        if(this.idleTimer > 0){
	            delete creep.memory.idleCheck;
	        }
	    }

	}

	module.exports = SimpleWorker;

/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(8);

	var defaultTypes = [
	    STRUCTURE_SPAWN,
	    STRUCTURE_EXTENSION,
	    STRUCTURE_TOWER
	];

	class DeliverWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'deliver', { requiresEnergy: true }); }

	    isValid(creep, opts, job, target){
	        return super.isValid(creep, opts, job, target) && this.catalog.getAvailableCapacity(target) > 10;
	    }

	    calculateAllocation(creep, opts){
	        return this.catalog.getResource(creep, RESOURCE_ENERGY);
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        if(opts.ignoreCreeps && job.creep){
	            return false;
	        }
	        if(job.target.structureType && !_.includes(opts.types || defaultTypes, job.target.structureType)){
	            return false;
	        }
	        return this.getEnergyOffset(creep) + distance / this.distanceWeight + this.catalog.getResourcePercent(job.target, RESOURCE_ENERGY)/10 + job.offset;
	    }

	    processStep(creep, job, target, opts){
	        if(creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE){
	            creep.moveTo(target);
	        }
	    }

	}

	module.exports = DeliverWorker;

/***/ },
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var SimpleWorker = __webpack_require__(9);

	class DropWorker extends SimpleWorker {
	    constructor(catalog){ super(catalog, 'drop', { requiresEnergy: true }); }

	    stillValid(creep, opts){
	        return this.catalog.getResource(creep, opts.type || RESOURCE_ENERGY) > 0;
	    }

	    bid(creep, opts){
	        if(this.catalog.getResource(creep, RESOURCE_ENERGY) == 0){
	            return false;
	        }
	        var bid = this.getResourceOffset(creep, opts.type || RESOURCE_ENERGY) + _.get(opts, 'priority', 0);
	        return { bid, type: this.type };
	    }

	    process(creep, opts){
	        creep.drop(opts.type || RESOURCE_ENERGY, this.catalog.getResource(creep, opts.type || RESOURCE_ENERGY));
	    }

	}

	module.exports = DropWorker;

/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(8);

	class MineWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'mine'); }

	    isValid(creep, opts, job, target){
	        return this.catalog.getAvailableCapacity(creep) > 8;
	    }

	    canBid(creep, opts){
	        return !this.catalog.isFull(creep);
	    }

	    calculateAllocation(creep, opts){
	        return creep.getActiveBodyparts(WORK);
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        // var availableRatio = this.calcAvailRatio(job, allocation);
	        return this.catalog.getResourcePercent(creep, RESOURCE_ENERGY) + distance / this.distanceWeight;
	    }

	    processStep(creep, job, target, opts){
	        if(this.catalog.getAvailableCapacity(creep) < 20){
	            var deliverables = _.filter(this.catalog.jobs.getOpenJobs('deliver'), job => !job.creep && creep.pos.getRangeTo(job.target) <= 1 && this.catalog.getAvailableCapacity(job.target) > 0);
	            var nearby = _.sortBy(deliverables, job => this.catalog.getAvailableCapacity(job.target));
	            if(nearby.length > 0){
	                creep.transfer(nearby[0].target, RESOURCE_ENERGY);
	            }
	        }
	        if(creep.harvest(target) == ERR_NOT_IN_RANGE){
	            creep.moveTo(target);
	        }
	    }

	}

	module.exports = MineWorker;

/***/ },
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(8);

	class ObserveWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'observe', { idleTimer: 50 }); }

	    calculateAllocation(creep, opts){
	        return 1;
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        return distance/this.distanceWeight;
	    }

	    processStep(creep, job, target, opts){
	        if(this.getJobDistance(creep, job) > 1){
	            creep.moveTo(target);
	        }
	    }

	}

	module.exports = ObserveWorker;

/***/ },
/* 14 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(8);

	class PickupWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'pickup'); }

	    isValid(creep, opts, job, target){
	        return !this.catalog.isFull(creep) && this.catalog.getResource(target, RESOURCE_ENERGY) > 0;
	    }

	    canBid(creep, opts){
	        return !this.catalog.isFull(creep);
	    }

	    calculateAllocation(creep, opts){
	        return creep.getActiveBodyparts(CARRY);
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        var availableRatio = this.calcAvailRatio(job, allocation);
	        return 1 + this.getEnergyOffset(creep) + distance / this.distanceWeight + availableRatio;
	    }

	    processStep(creep, job, target, opts){
	        var result;
	        if(target.resourceType){
	            result = creep.pickup(target);
	        }else{
	            result = creep.withdraw(target, RESOURCE_ENERGY);
	        }
	        if(result == ERR_NOT_IN_RANGE){
	            creep.moveTo(target);
	        }
	    }

	}

	module.exports = PickupWorker;

/***/ },
/* 15 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(8);

	class RepairWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'repair', { requiresEnergy: true, chatty: true }); }

	    calculateAllocation(creep, opts){
	        if(creep.getActiveBodyparts(WORK) > 0){
	            return this.catalog.getResource(creep, RESOURCE_ENERGY);
	        }
	        return 0;
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        return this.getEnergyOffset(creep) + distance / this.distanceWeight;
	    }

	    processStep(creep, job, target, opts){
	        if(creep.repair(target) == ERR_NOT_IN_RANGE){
	            creep.moveTo(target);
	        }
	    }

	}

	module.exports = RepairWorker;

/***/ },
/* 16 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(8);

	class ReserveWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'reserve'); }

	    calculateAllocation(creep, opts){
	        return creep.getActiveBodyparts(CLAIM);
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        return distance/this.distanceWeight;
	    }

	    processStep(creep, job, target, opts){
	        if(target.name){
	            creep.moveTo(target);
	        }else if(creep.memory.claim && creep.claimController(target) == OK){
	            creep.memory.claim = false;
	        }else if(creep.reserveController(target) == ERR_NOT_IN_RANGE){
	            creep.moveTo(target);
	        }
	    }

	}

	module.exports = ReserveWorker;

/***/ },
/* 17 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(8);

	class UpgradeWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'upgrade', { requiresEnergy: true, chatty: true, idleTimer: 50 }); }

	    calculateAllocation(creep, opts){
	        return creep.getActiveBodyparts(WORK);
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        return this.getEnergyOffset(creep) + distance / this.distanceWeight;
	    }

	    processStep(creep, job, target, opts){
	        if(creep.upgradeController(target) == ERR_NOT_IN_RANGE){
	            creep.moveTo(target);
	        }
	    }

	}

	module.exports = UpgradeWorker;

/***/ },
/* 18 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var JobManager = __webpack_require__(19);

	class Catalog {
	    constructor(){
	        this.types = {
	            collect: [ STRUCTURE_CONTAINER ],
	            dropoff: [ STRUCTURE_STORAGE ],
	            energy: [ STRUCTURE_STORAGE, STRUCTURE_CONTAINER, STRUCTURE_LINK ],
	            allResources: [ STRUCTURE_STORAGE, STRUCTURE_CONTAINER, STRUCTURE_TERMINAL, STRUCTURE_LAB, STRUCTURE_LINK ],
	            spawn: [ STRUCTURE_SPAWN, STRUCTURE_EXTENSION ],
	            energyNeeds: [ STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_STORAGE ],
	            storage: [ STRUCTURE_STORAGE, STRUCTURE_CONTAINER ],
	            walls: [ STRUCTURE_WALL, STRUCTURE_RAMPART ]
	        };

	        this.structures = {};
	        this.hostile = {
	            structures: {},
	            creeps: {}
	        };

	        this.roomData = {};
	        // roomData: {
	        //     energy,
	        //     minerals,
	        //     mineralAmount,
	        //     mineralType,
	        //     sources,
	        //     sourceEnergy
	        // }

	        this.droppedResources = {};
	        this.flagsPrefix = {};

	        this.creeps = {
	            class: _.groupBy(Game.creeps, creep => creep.memory.class),
	            type: _.groupBy(Game.creeps, creep => creep.memory.type),
	            room: _.groupBy(Game.creeps, creep => creep.pos.roomName)
	        };

	        this.rooms = _.filter(Game.rooms, 'controller.my');

	        this.jobs = new JobManager(this);

	        //class
	        this.deficits = {};

	    }

	    getRoomData(room){
	        if(!room.name){
	            return false;
	        }
	        if(!this.roomData[room.name]){
	            var minerals = room.find(FIND_MINERALS);
	            var sources = room.find(FIND_SOURCES);
	            this.roomData[room.name] = {
	                energy: _.reduce(this.getResourceContainers(room, this.types.energyContainers, RESOURCE_ENERGY), (result, structure) => result += this.getResource(structure, RESOURCE_ENERGY), 0),
	                minerals,
	                mineralAmount: _.reduce(minerals, (result, mineral) => result += mineral.mineralAmount, 0),
	                mineralType: _.get(minerals, '[0].mineralType', false),
	                sources,
	                sourceEnergy: _.reduce(sources, (result, source) => result += source.energy, 0)
	            };
	        }
	        return this.roomData[room.name];
	    }

	    // getEnergyNeeds(creep, { ignoreCreeps, ignoreClass, containerTypes, maxRange, excludeRemote, maxStorage }){
	    //     var types = [
	    //         STRUCTURE_CONTAINER,
	    //         STRUCTURE_EXTENSION,
	    //         STRUCTURE_TOWER,
	    //         STRUCTURE_LINK,
	    //         STRUCTURE_STORAGE,
	    //         STRUCTURE_SPAWN
	    //     ];
	    //     var containers = _.filter(this.buildings[creep.pos.roomName],
	    //                               structure => _.includes(containerTypes || types, structure.structureType)
	    //                                             && RoomUtil.getEnergyPercent(structure) < 1
	    //                                             && (!maxStorage || RoomUtil.getEnergy(structure) < maxStorage)
	    //                              );

	    //     var filterClass = _.isArray(ignoreClass);
	    //     if(filterClass || !ignoreCreeps){
	    //         var targetCreeps = creep.room.find(FIND_MY_CREEPS, {
	    //             filter: (target)=>!RoomUtil.energyFull(target) && (!filterClass || !_.includes(ignoreClass, target.memory.class))
	    //         });

	    //         if(excludeRemote){
	    //             targetCreeps = _.filter(targetCreeps, creep => !creep.memory.remote);
	    //         }

	    //         if(targetCreeps.length > 0){
	    //             containers = containers.concat(targetCreeps);
	    //         }
	    //     }
	    //     if(maxRange > 0){
	    //         containers = _.filter(containers, target => creep.pos.getRangeTo(target) <= maxRange);
	    //     }

	    //     return _.sortBy(containers, container => RoomUtil.getEnergyPercent(container) + creep.pos.getRangeTo(container)/50 + Catalog.getEnergyDeliveryOffset(container));
	    // }

	    getFlagsByPrefix(prefix){
	        if(!this.flagsPrefix[prefix]){
	            this.flagsPrefix[prefix] = _.filter(Game.flags, flag => flag.name.startsWith(prefix));
	        }
	        return this.flagsPrefix[prefix];
	    }

	    getStructures(room){
	        if(!room.name){ return []; }
	        if(!this.structures[room.name]){
	            this.structures[room.name] = room.find(FIND_STRUCTURES);
	        }
	        return this.structures[room.name];
	    }

	    getStructuresByType(room, type){
	        if(_.isArray(type)){
	            return _.filter(this.getStructures(room), structure => _.includes(type, structure.structureType));
	        }
	        return _.filter(this.getStructures(room), structure => structure.structureType == type);
	    }

	    getFirstBuilding(room, type){
	        return _.first(_.filter(this.structures[room.name], structure => structure.structureType == type));
	    }

	    getHostiles(room){
	        return this.getHostileCreeps(room).concat(this.getHostileStructures(room));
	    }

	    getHostileCreeps(room){
	        if(!this.hostile.creeps[room.name]){
	            this.hostile.creeps[room.name] = room.find(FIND_HOSTILE_CREEPS);
	        }
	        return this.hostile.creeps[room.name];
	    }

	    getHostileStructures(room){
	        if(!this.hostile.structures[room.name]){
	            this.hostile.structures[room.name] = room.find(FIND_HOSTILE_STRUCTURES);
	        }
	        return this.hostile.structures[room.name];
	    }

	    getCreeps(room){
	        if(!room.name){ return []; }
	        return this.creeps.room[room.name];
	    }

	    getResourceContainers(room, containerTypes, resourceType){
	        if(!room.name){ return []; }
	        if(!resourceType){
	            resourceType = RESOURCE_ENERGY;
	        }
	        var containers = _.filter(this.getStructuresByType(room, containerTypes || this.types.storage), structure => this.getResource(structure, resourceType) > 0);
	        return containers.concat(_.filter(this.getDroppedResources(room), { resourceType }));
	    }

	    getDroppedResources(room){
	        if(!room.name){ return []; }
	        if(!this.droppedResources[room.name]){
	            this.droppedResources[room.name] = room.find(FIND_DROPPED_RESOURCES);
	        }
	        return this.droppedResources[room.name];
	    }

	    getResource(entity, type){
	        if(!entity){
	            return 0;
	        }
	        if(!type){
	            type = RESOURCE_ENERGY;
	        }
	        if(entity.carryCapacity > 0){
	            return entity.carry[type];
	        }else if(entity.storeCapacity > 0){
	            return entity.store[type];
	        }else if(entity.energyCapacity > 0 && type === RESOURCE_ENERGY){
	            return entity.energy;
	        }else if(entity.resourceType && entity.resourceType == type && entity.amount > 0){
	            return entity.amount;
	        }
	        return 0;
	    }

	    getCapacity(entity){
	        if(!entity){
	            return 0;
	        }
	        if(entity.carryCapacity > 0){
	            return entity.carryCapacity;
	        }else if(entity.storeCapacity > 0){
	            return entity.storeCapacity;
	        }else if(entity.energyCapacity > 0){
	            return entity.energyCapacity;
	        }else if(entity.resourceType && entity.amount > 0){
	            return entity.amount;
	        }
	        return 0;
	    }
	    
	    getStorage(entity){
	        if(!entity){
	            return 0;
	        }
	        if(entity.carryCapacity > 0){
	            return _.sum(entity.carry);
	        }else if(entity.storeCapacity > 0){
	            return _.sum(entity.store);
	        }else if(entity.energyCapacity > 0){
	            return entity.energy;
	        }else if(entity.resourceType && entity.resourceType == RESOURCE_ENERGY && entity.amount > 0){
	            return entity.amount;
	        }
	        return 0;
	    }

	    isFull(entity){
	        return this.getAvailableCapacity(entity) < 1;
	    }

	    getAvailableCapacity(entity){
	        return this.getCapacity(entity) - this.getStorage(entity);
	    }

	    getStoragePercent(entity){
	        return this.getStorage(entity) / this.getCapacity(entity);
	    }

	    getResourcePercent(entity, type){
	        return this.getResource(entity, type) / this.getCapacity(entity);
	    }

	    isCreep(entity){
	        return entity.carryCapacity > 0;
	    }
	}

	module.exports = Catalog;

/***/ },
/* 19 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var Jobs = __webpack_require__(20);

	class JobManager {
	    constructor(catalog){
	        this.catalog = catalog;
	        this.jobs = {};
	        this.capacity = {};
	        this.allocation = {};
	        this.categories = Jobs(catalog);
	    }

	    generate(){
	        _.forEach(this.categories, category =>{
	            var cap = 0;
	            this.jobs[category.getType()] = category.generate();
	            _.forEach(this.jobs[category.getType()], job => cap += job.capacity);
	            this.capacity[category.getType()] = cap;
	            this.allocation[category.getType()] = 0;
	        });
	    }

	    allocate(){
	        _.forEach(Game.creeps, creep => this.addAllocation(creep.memory.jobType, creep.memory.jobId, creep.memory.jobAllocation));
	    }

	    getOpenJobs(type){
	        return _.pick(this.jobs[type], job => job.allocated < job.capacity);
	    }

	    getJob(type, id){
	        return _.get(this.jobs, [type, id], false);
	    }

	    addAllocation(type, jobId, allocation){
	        if(jobId && type && _.has(this.jobs, [type, jobId])){
	            _.set(this.jobs[type], [jobId, 'allocated'], _.get(this.jobs[type], [jobId, 'allocated'], 0) + allocation);
	            this.allocation[type] += allocation;
	        }
	    }
	}

	module.exports = JobManager;

/***/ },
/* 20 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var Build = __webpack_require__(21);
	var Deliver = __webpack_require__(23);
	var Mine = __webpack_require__(24);
	var Observe = __webpack_require__(25);
	var Pickup = __webpack_require__(26);
	var Repair = __webpack_require__(27);
	var Reserve = __webpack_require__(28);
	var Upgrade = __webpack_require__(29);
	// var Heal = require('./heal');

	module.exports = function(catalog){
	    return {
	        build: new Build(catalog),
	        deliver: new Deliver(catalog),
	        mine: new Mine(catalog),
	        observe: new Observe(catalog),
	        pickup: new Pickup(catalog),
	        repair: new Repair(catalog),
	        reserve: new Reserve(catalog),
	        upgrade: new Upgrade(catalog)
	    };
	};

/***/ },
/* 21 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(22);

	class BuildJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'build', { flagPrefix: 'Build' }); }

	    generateJobs(room){
	        return _.map(room.find(FIND_MY_CONSTRUCTION_SITES), site => {
	            return {
	                allocated: 0,
	                capacity: Math.min(Math.ceil((site.progressTotal - site.progress)/5), 40),
	                id: this.generateId(site),
	                target: site
	            }
	        });
	    }

	    generateJobsForFlag(flag){
	        if(!flag.room){
	            return [];
	        }
	        return this.generateJobs(flag.room);
	    }
	}

	module.exports = BuildJob;

/***/ },
/* 22 */
/***/ function(module, exports) {

	"use strict";

	class BaseJob {
	    constructor(catalog, type, opts){
	        this.catalog = catalog;
	        this.type = type;
	        if(opts){
	            _.assign(this, opts);
	        }
	    }

	    getType(){
	        return this.type;
	    }

	    generateId(entity){
	        return this.type+'-'+entity.id;
	    }

	    getRooms(){
	        return this.catalog.rooms;
	    }

	    generate(){
	        var jobs = {};
	        _.forEach(this.getRooms(), room => _.forEach(this.generateJobs(room), job => jobs[job.id] = job));
	        if(this.flagPrefix){
	            _.forEach(this.catalog.getFlagsByPrefix(this.flagPrefix), flag => _.forEach(this.generateJobsForFlag(flag), job => jobs[job.id] = job));
	        }
	        return jobs;
	    }

	    generateJobs(room){
	        return [];
	    }

	    generateJobsForFlag(flag){
	        return [];
	    }

	}

	module.exports = BaseJob;

/***/ },
/* 23 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(22);

	var offsets = {
	    spawn: -0.25,
	    extension: -0.25,
	    container: 0.5,
	    storage: 0.25,
	    link: 0.125,
	    tower: 0
	};

	var types = [
	    STRUCTURE_SPAWN,
	    STRUCTURE_EXTENSION,
	    STRUCTURE_STORAGE,
	    STRUCTURE_CONTAINER,
	    STRUCTURE_TERMINAL,
	    STRUCTURE_LAB,
	    STRUCTURE_LINK,
	    STRUCTURE_TOWER
	];

	class DeliverJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'deliver'); }

	    generateJobs(room){
	        var energyNeeds = _.filter(this.catalog.getStructuresByType(room, types), structure => this.catalog.getAvailableCapacity(structure) > 0);
	        var creeps = this.catalog.creeps.class['worker'];
	        if(creeps && creeps.length > 0){
	            energyNeeds = energyNeeds.concat(creeps);
	        }
	        return _.map(energyNeeds, entity => {
	            return {
	                allocated: 0,
	                capacity: this.catalog.getAvailableCapacity(entity),
	                id: this.generateId(entity),
	                target: entity,
	                creep: this.catalog.isCreep(entity),
	                offset: this.getOffset(entity.structureType)
	            }
	        });
	    }

	    getOffset(type){
	        if(!type){
	            return 0;
	        }
	        return _.get(offsets, type, 0);
	    }
	}

	module.exports = DeliverJob;

/***/ },
/* 24 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(22);

	class MineJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'mine', { flagPrefix: 'Mine' }); }

	    generateJobs(room){
	        return _.map(room.find(FIND_SOURCES), source => this.generateSource(source));
	    }

	    generateJobsForFlag(flag){
	        if(!flag.room){
	            return [];
	        }
	        return _.map(flag.room.find(FIND_SOURCES), source => this.generateSource(source));
	    }

	    generateSource(source){
	        return {
	            allocated: 0,
	            capacity: Math.floor(source.energyCapacity/600)+1,
	            id: this.generateId(source),
	            target: source
	        }
	    }
	}

	module.exports = MineJob;



/***/ },
/* 25 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(22);

	class ObserveJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'observe', { flagPrefix: 'Observe' }); }

	    generateJobsForFlag(flag){
	        return [{
	            allocated: 0,
	            capacity: 1,
	            id: this.type+"-"+flag.name,
	            target: flag
	        }];
	    }
	}

	module.exports = ObserveJob;

/***/ },
/* 26 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(22);

	var types = [
	    STRUCTURE_STORAGE,
	    STRUCTURE_CONTAINER,
	    STRUCTURE_LINK
	];

	class PickupJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'pickup'); }

	    generateJobs(room){
	        var energy = this.catalog.getResourceContainers(room, types, RESOURCE_ENERGY);
	        return _.map(energy, structure => {
	            return {
	                allocated: 0,
	                capacity: Math.ceil(this.catalog.getResource(structure, RESOURCE_ENERGY)/50),
	                id: this.generateId(structure),
	                target: structure
	            }
	        });
	    }
	}

	module.exports = PickupJob;

/***/ },
/* 27 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(22);

	class RepairJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'repair'); }

	    generateJobs(room){
	        return _.map(_.filter(this.catalog.getStructures(room), structure => structure.hits < Math.min(structure.hitsMax, Memory.settings.repairTarget)), structure => {
	            return {
	                allocated: 0,
	                capacity: Math.min(Math.ceil(Math.max(0, Math.min(structure.hitsMax, Memory.settings.repairTarget) - structure.hits)/100), 10),
	                id: this.generateId(structure),
	                target: structure
	            }
	        });
	    }
	}

	module.exports = RepairJob;

/***/ },
/* 28 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(22);

	class ReserveJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'reserve', { flagPrefix: 'Reserve' }); }

	    generateJobsForFlag(flag){
	        return [{
	            allocated: 0,
	            capacity: 2,
	            id: this.type+"-"+flag.name,
	            target: _.get(flag.room, 'controller', flag)
	        }];
	    }
	}

	module.exports = ReserveJob;

/***/ },
/* 29 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(22);

	class UpgradeJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'upgrade'); }

	    generateJobs(room){
	        return [{
	            allocated: 0,
	            capacity: Memory.settings.upgradeCapacity || 10,
	            id: this.generateId(room.controller),
	            target: room.controller
	        }];
	    }
	}

	module.exports = UpgradeJob;

/***/ },
/* 30 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var RoomUtil = __webpack_require__(2);

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
	        stats.global = {
	            maxSpawn: _.max(_.map(stats.rooms, 'spawn')),
	            totalEnergy: _.sum(_.map(stats.rooms, 'energy'))
	        }
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

/***/ }
/******/ ]);