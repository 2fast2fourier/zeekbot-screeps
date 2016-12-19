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
	var Catalog = __webpack_require__(23);
	var Misc = __webpack_require__(40);

	module.exports.loop = function () {
	    // var start = Game.cpu.getUsed();
	    if(!Memory.upgradedLogic){
	        Misc.setSettings();
	        Memory.updateTime = 0;
	        Spawner.resetBehavior(catalog);
	        Memory.upgradedLogic = true;
	    }
	    if(!Memory.settings){
	        Misc.setSettings();
	    }

	    Misc.mourn();

	    var catalog = new Catalog();

	    if(Memory.updateTime < Game.time || !Memory.updateTime){
	        Misc.updateStats(catalog);
	        Memory.updateTime = Game.time + Memory.settings.updateDelta;
	    }
	    // var cat = Game.cpu.getUsed();

	    catalog.jobs.generate();
	    catalog.jobs.allocate();

	    // console.log(_.size(catalog.jobs.jobs.repair), catalog.jobs.capacity.repair);

	    // var jobs = Game.cpu.getUsed();
	    WorkManager.process(catalog);

	    // var worker = Game.cpu.getUsed();
	    Spawner.spawn(catalog);

	    // var spawner = Game.cpu.getUsed();
	    Controller.control(catalog);

	    // var controller = Game.cpu.getUsed();
	    // if(Game.cpu.getUsed() > Game.cpu.limit){
	    //     console.log('---- start', Game.cpu.bucket, start, Game.cpu.getUsed(),'----');
	    //     console.log('catalog', cat - start);
	    //     console.log('jobs', jobs - cat);
	    //     console.log('worker', worker - jobs);
	    //     console.log('spawner', spawner - worker);
	    //     console.log('controller', controller - spawner);
	    // }
	}

/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var RoomUtil = __webpack_require__(2);

	class Controller {

	    static control(catalog){
	        var towers = _.filter(Game.structures, {structureType: STRUCTURE_TOWER});
	        towers.forEach((tower, ix) => {
	            if(!Memory.standDown && !Controller.towerDefend(tower, catalog)){
	                if(!Controller.towerHeal(tower, catalog) && tower.energy > tower.energyCapacity * 0.75){
	                    Controller.towerRepair(tower, catalog, ix);
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

	    static towerRepair(tower, catalog, ix) {
	        var damagedBuildings = _.filter(catalog.getStructures(tower.room), structure => structure.hits < Math.min(structure.hitsMax, Memory.repairTarget) * Memory.settings.towerRepairPercent);
	        if(damagedBuildings.length > ix) {
	            var damaged = _.sortBy(damagedBuildings, structure => structure.hits / Math.min(structure.hitsMax, Memory.repairTarget));
	            tower.repair(damaged[ix]);
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
	            var targetCapacity = Math.ceil(needCapacity * _.get(quota, 'ratio', 1));
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
	                count += catalog.getFlagsByPrefix(additionalPer.flagPrefix).length * _.get(additionalPer, 'count', 1);
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
	        var classConvert = {
	            keepminer: 'miner',
	            keepfighter: 'fighter',
	            tender: 'hauler'
	        }
	        var classFallback = {
	            miner: 'milli',
	            hauler: 'micro',
	            worker: 'milli',
	            healer: 'pico',
	            fighter: 'melee'
	        }
	        _.forEach(Game.creeps, creep=>{
	            var newClass = _.get(classConvert, creep.memory.class, creep.memory.class);
	            var newVer = creep.memory.version;
	            var config = _.get(classConfig, newClass, false);
	            if(!config){
	                console.log('failed to find class', creep.memory.class, creep);
	                return;
	            }
	            var version = _.get(config, ['versions', creep.memory.version], false);
	            if(!version){
	                newVer = classFallback[newClass];
	                version = _.get(config, ['versions', newVer], false);
	                if(!version){
	                    console.log('failed to find version', creep.memory.version);
	                    return;
	                }
	                console.log('converting from', creep.memory.version, 'to', newVer, creep);
	            }
	            creep.memory.version = newVer;
	            creep.memory.type = newVer + newClass;
	            creep.memory.class = newClass;
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
	                allocation: 7,
	                critical: 1400,
	                parts: {move: 5, carry: 2, work: 7}
	            },
	            micro: {
	                allocation: 6,
	                critical: 750,
	                disable: {
	                    maxSpawn: 1400
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
	            pico: {
	                bootstrap: 1,
	                quota: false,
	                critical: 300,
	                parts: {work: 2, carry: 1, move: 1},
	                disable: {
	                    energy: 2000
	                }
	            }
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
	                critical: 600,
	                parts: {carry: 6, move: 6},
	                additionalPer: {
	                    room: 2
	                },
	                rules: {
	                    pickup: {},
	                    deliver: { types: [ STRUCTURE_SPAWN, STRUCTURE_EXTENSION ], ignoreCreeps: true },
	                    idle: { type: 'spawn' }
	                }
	            },
	            picospawn: {
	                bootstrap: 1,
	                critical: 300,
	                parts: {carry: 3, move: 3},
	                rules: {
	                    pickup: {},
	                    deliver: { types: [ STRUCTURE_SPAWN, STRUCTURE_EXTENSION ], ignoreCreeps: true },
	                    idle: { type: 'spawn' }
	                }
	            },
	            long: {
	                ideal: 2,
	                additionalPer: {
	                    count: 4,
	                    flagPrefix: 'Pickup'
	                },
	                rules: {
	                    pickup: { minerals: true, types: [ STRUCTURE_CONTAINER ] },
	                    deliver: { types: [ STRUCTURE_STORAGE ], ignoreCreeps: true }
	                },
	                parts: {carry: 10, move: 10}
	            },
	            leveler: {
	                additionalPer: {
	                    room: 1
	                },
	                rules: {
	                    pickup: { types: [ STRUCTURE_STORAGE ], min: 100000 },
	                    deliver: { types: [ STRUCTURE_STORAGE ], ignoreCreeps: true }
	                },
	                parts: {carry: 10, move: 10}
	            },
	            micro: {
	                additionalPer: {
	                    room: 2
	                },
	                parts: {carry: 6, move: 6}
	            },
	            nano: {
	                ideal: 2,
	                disable: {
	                    maxSpawn: 600
	                },
	                parts: {carry: 5, move: 5}
	            },
	            pico: {
	                bootstrap: 1,
	                parts: {carry: 2, move: 2}
	            }
	        },
	        rules: {
	            pickup: { minerals: true, types: [ STRUCTURE_STORAGE, STRUCTURE_CONTAINER ] },
	            deliver: {}
	        }
	    },
	    observer: {
	        versions: {
	            pico: {
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
	    worker: {
	        versions: {
	            milli: {
	                additionalPer: {
	                    room: 2,
	                    flagPrefix: 'Repair'
	                },
	                parts: {work: 4, carry: 4, move: 8}
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
	            // pico: {
	            //     bootstrap: 1,
	            //     parts: {work: 1, carry: 2, move: 2}
	            // },
	            upgrade: {
	                quota: {
	                    jobType: 'upgrade',
	                    allocation: 5,
	                    ratio: 1
	                },
	                parts: {work: 5, carry: 2, move: 7},
	                rules: { pickup: {}, upgrade: {} }
	            },
	            repair: {
	                quota: {
	                    jobType: 'repair',
	                    allocation: 100,
	                    ratio: 0.5,
	                    max: 10
	                },
	                rules: {
	                    pickup: {},
	                    repair: {},
	                },
	                parts: {work: 2, carry: 2, move: 4}
	            }
	        },
	        rules: {
	            pickup: {},
	            build: {},
	            repair: { priority: 2 },
	            upgrade: { priority: 10 },
	            idle: { type: 'worker' }
	        }
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
	    },
	    healer: {
	        versions: {
	            pico: {
	                ideal: 1,
	                parts: {tough: 4, move: 8, heal: 4}
	            },
	        },
	        quota: {
	            jobType: 'heal',
	            allocation: 1,
	            max: 2
	        },
	        rules: { heal: {}, idle: { type: 'heal' } }
	    },
	    fighter: {
	        versions: {
	            ranged: {
	                additionalPer: {
	                    count: 2,
	                    flagPrefix: 'Defend'
	                },
	                parts: {tough: 10, move: 10, ranged_attack: 10},
	                rules: { defend: { ranged: true }, idle: { type: 'defend' } }
	            },
	            melee: {
	                additionalPer: {
	                    count: 1,
	                    flagPrefix: 'Keep'
	                },
	                quota: {
	                    jobType: 'keep',
	                    allocation: 15
	                },
	                parts: {tough: 17, move: 16, attack: 15}
	            }
	        },
	        rules: { defend: {}, keep: {}, idle: { type: 'keep' } }
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
	                catalog.jobs.removeAllocation(creep.memory.jobType, creep.memory.jobId, creep.memory.jobAllocation);
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

	var Attack = __webpack_require__(7);
	var Build = __webpack_require__(10);
	var Defend = __webpack_require__(11);
	var Deliver = __webpack_require__(12);
	var Drop = __webpack_require__(13);
	var Heal = __webpack_require__(14);
	var Idle = __webpack_require__(15);
	var Keep = __webpack_require__(16);
	var Mine = __webpack_require__(17);
	var Observe = __webpack_require__(18);
	var Pickup = __webpack_require__(19);
	var Repair = __webpack_require__(20);
	var Reserve = __webpack_require__(21);
	var Upgrade = __webpack_require__(22);

	module.exports = function(catalog){
	    return {
	        attack: new Attack(catalog),
	        build: new Build(catalog),
	        defend: new Defend(catalog),
	        deliver: new Deliver(catalog),
	        drop: new Drop(catalog),
	        heal: new Heal(catalog),
	        idle: new Idle(catalog),
	        keep: new Keep(catalog),
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

	class AttackWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'attack', { chatty: true }); }

	    calculateAllocation(creep, opts){
	        return creep.getActiveBodyparts(ATTACK) + creep.getActiveBodyparts(RANGED_ATTACK);
	    }

	    canBid(creep, opts){
	        if(creep.hits < creep.hitsMax / 2){
	            return false;
	        }
	        return true;
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        if(distance > 10){
	            return false;
	        }
	        return distance / this.distanceWeight;
	    }

	    processStep(creep, job, target, opts){
	        if(opts.ranged){
	            if(creep.pos.getRangeTo(target) > 3){
	                creep.moveTo(target);
	            }else{
	                creep.rangedAttack(target);
	            }
	        }else{
	            if(creep.attack(target) == ERR_NOT_IN_RANGE){
	                creep.moveTo(target);
	            }
	            if(creep.getActiveBodyparts(RANGED_ATTACK) > 0 && creep.pos.getRangeTo(target) <= 3){
	                creep.rangedAttack(target);
	            }
	        }
	    }

	}

	module.exports = AttackWorker;

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
	        return this.catalog.getRealDistance(creep, job.target);
	        // return Math.min(creep.pos.getRangeTo(job.target), 99);
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
	        // var start = Game.cpu.getUsed();
	        var lowestBid = 99999999;
	        var allocation = this.calculateAllocation(creep, opts);
	        if(!allocation){
	            return false;
	        }
	        var jobs = this.getOpenJobs();
	        var result = _.reduce(jobs, (result, job) =>{
	            var distance = this.getJobDistance(creep, job);
	            if(opts.maxRange > 0 && distance > opts.maxRange){
	                return result;
	            }
	            if(opts.local && creep.pos.roomName != _.get(job, 'target.pos.roomName')){
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
	        // console.log(this.type, Game.cpu.getUsed() - start);
	        return result;
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

	    getStorageOffset(creep){
	        return 1 - this.catalog.getStoragePercent(creep);
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

	class BuildWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'build', { requiresEnergy: true, chatty: true }); }

	    calculateAllocation(creep, opts){
	        if(creep.getActiveBodyparts(WORK) > 0){
	            return Math.ceil(this.catalog.getResource(creep, RESOURCE_ENERGY)/5);
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
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(8);

	class DefendWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'defend', { flagPrefix: 'Defend', chatty: true }); }

	    calculateAllocation(creep, opts){
	        return creep.getActiveBodyparts(ATTACK) + creep.getActiveBodyparts(RANGED_ATTACK);
	    }

	    // canBid(creep, opts){
	    //     if(creep.hits < creep.hitsMax / 2){
	    //         return false;
	    //     }
	    //     return true;
	    // }

	    isValid(){
	        return false;
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        if(job.keeper && distance > 10){
	            return false;
	        }
	        return distance / this.distanceWeight;
	    }

	    processStep(creep, job, target, opts){
	        if(opts.ranged){
	            if(creep.pos.getRangeTo(target) > 3){
	                creep.moveTo(target);
	            }else{
	                creep.rangedAttack(target);
	            }
	            if(creep.pos.getRangeTo(target) < 3){
	                creep.move((creep.pos.getDirectionTo(target)+4)%8);
	            }
	        }else{
	            if(creep.attack(target) == ERR_NOT_IN_RANGE){
	                creep.moveTo(target);
	            }
	            if(creep.getActiveBodyparts(RANGED_ATTACK) > 0 && creep.pos.getRangeTo(target) <= 3){
	                creep.rangedAttack(target);
	            }
	        }
	    }

	}

	module.exports = DefendWorker;

/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(8);

	var defaultTypes = [
	    STRUCTURE_SPAWN,
	    STRUCTURE_EXTENSION,
	    STRUCTURE_TOWER
	];

	var mineralTypes = [
	    STRUCTURE_STORAGE,
	    STRUCTURE_TERMINAL,
	    STRUCTURE_LAB
	];

	class DeliverWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'deliver'); }

	    isValid(creep, opts, job, target){
	        return super.isValid(creep, opts, job, target) && this.catalog.getAvailableCapacity(target) > 10 && this.catalog.getStorage(creep) > 0;
	    }

	    calculateAllocation(creep, opts){
	        return this.catalog.getStorage(creep);
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        if(opts.ignoreCreeps && job.creep){
	            return false;
	        }
	        if(creep.memory.lastSource == job.target.id){
	            return false;
	        }
	        if(this.catalog.hasMinerals(creep)){
	            if(!job.minerals || !job.target.structureType || !_.includes(opts.mineralTypes || mineralTypes, job.target.structureType)){
	                // console.log(creep, job.target, job.minerals);
	                return false;
	            }
	        }else{
	            if(job.target.structureType && !_.includes(opts.types || defaultTypes, job.target.structureType)){
	                return false;
	            }
	        }
	        return this.getStorageOffset(creep) + distance / this.distanceWeight + this.catalog.getStoragePercent(job.target)/10 + job.offset;
	    }

	    processStep(creep, job, target, opts){
	        var done = false;
	        _.forEach(this.catalog.getResourceList(creep), (amount, type) => {
	            if(done){
	                return;
	            }
	            var result = creep.transfer(target, type);
	            if(result == ERR_NOT_IN_RANGE){
	                creep.moveTo(target);
	                done = true;
	            }else if(result == OK){
	                done = true;
	            }
	        });
	    }

	}

	module.exports = DeliverWorker;

/***/ },
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var SimpleWorker = __webpack_require__(9);

	class DropWorker extends SimpleWorker {
	    constructor(catalog){ super(catalog, 'drop', { requiresEnergy: true }); }

	    stillValid(creep, opts){
	        return this.catalog.getStorage(creep) > 0;
	    }

	    bid(creep, opts){
	        if(this.catalog.getStorage(creep) == 0){
	            return false;
	        }
	        var bid = this.getResourceOffset(creep, opts.type || RESOURCE_ENERGY) + _.get(opts, 'priority', 0);
	        return { bid, type: this.type };
	    }

	    process(creep, opts){
	        _.forEach(creep.carry, (amount, type)=>{
	            if(amount > 0){
	                creep.drop(type, amount);
	            }
	        });
	    }

	}

	module.exports = DropWorker;

/***/ },
/* 14 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(8);

	class HealWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'heal', { chatty: true }); }

	    calculateAllocation(creep, opts){
	        return Math.min(creep.getActiveBodyparts(HEAL), 1);
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        return distance / this.distanceWeight + job.allocated + (0.25 - creep.ticksToLive/6000);
	    }

	    processStep(creep, job, target, opts){
	        var range = creep.pos.getRangeTo(target);
	        if(range > 1 && range <= 3){
	            creep.rangedHeal(target);
	            creep.moveTo(target);
	        }else if(creep.heal(target) == ERR_NOT_IN_RANGE){
	            creep.moveTo(target);
	        }
	    }

	}

	module.exports = HealWorker;

/***/ },
/* 15 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(8);

	class IdleWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'idle', { idleTimer: 5 }); }

	    calculateAllocation(creep, opts){
	        return 1;
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        if(opts.type && job.idleType !== opts.type){
	            return false;
	        }
	        return 999+distance/this.distanceWeight;
	    }

	    processStep(creep, job, target, opts){
	        if(creep.pos.getRangeTo(target) > 3){
	            creep.moveTo(target);
	        }
	    }

	}

	module.exports = IdleWorker;

/***/ },
/* 16 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(8);

	class KeepWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'keep'); }

	    isValid(creep, opts, job, target){
	        return job.capacity >= job.allocated && _.get(Memory.stats.rooms, [target.pos.roomName, 'hostileCount'], 0) == 0;
	    }

	    calculateAllocation(creep, opts){
	        return creep.getActiveBodyparts(ATTACK) + creep.getActiveBodyparts(RANGED_ATTACK);
	    }

	    canBid(creep, opts){
	        if(creep.hits < creep.hitsMax / 1.1){
	            return false;
	        }
	        return true;
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        return 99 + distance / this.distanceWeight + job.priority;
	    }

	    processStep(creep, job, target, opts){
	        if(creep.ticksToLive < 100){
	            creep.memory.jobAllocation = 10;
	        }
	        var pos = creep.pos;
	        var range = 10;
	        var targetRange = target.ticksToSpawn > 50 ? 2 : 1;
	        var hostiles = _.map(_.filter(creep.room.lookForAtArea(LOOK_CREEPS, pos.y - range, pos.x - range, pos.y + range, pos.x + range, true), target => !target.creep.my), 'creep');
	        if(hostiles.length > 0){
	            var enemy = _.first(_.sortBy(hostiles, hostile => creep.pos.getRangeTo(hostile)));
	            if(creep.attack(enemy) == ERR_NOT_IN_RANGE){
	                creep.moveTo(enemy);
	            }
	        }else if(creep.pos.getRangeTo(target) > targetRange){
	            creep.moveTo(target);
	        }else if(creep.pos.getRangeTo(target) < targetRange){
	            creep.move((creep.pos.getDirectionTo(target)+4)%8);
	        }
	    }

	}

	module.exports = KeepWorker;

/***/ },
/* 17 */
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
	        return this.catalog.getResourcePercent(creep, RESOURCE_ENERGY) + distance / this.distanceWeight;
	    }

	    processStep(creep, job, target, opts){
	        if(this.catalog.getAvailableCapacity(creep) < 20){
	            var deliverables = _.filter(this.catalog.jobs.getOpenJobs('deliver'), job => !job.creep && creep.pos.getRangeTo(job.target) <= 1 && this.catalog.getAvailableCapacity(job.target) > 0);
	            var nearby = _.sortBy(deliverables, job => this.catalog.getAvailableCapacity(job.target));
	            if(nearby.length > 0){
	                _.forEach(creep.carry, (amount, type)=>{
	                    if(amount > 0){
	                        creep.transfer(nearby[0].target, type);
	                    }
	                });
	            }
	        }
	        if(creep.harvest(target) == ERR_NOT_IN_RANGE){
	            creep.moveTo(target);
	        }
	    }

	}

	module.exports = MineWorker;

/***/ },
/* 18 */
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
/* 19 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(8);

	class PickupWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'pickup'); }

	    isValid(creep, opts, job, target){
	        return !this.catalog.isFull(creep) && this.catalog.getResource(target, job.resource) > 0;
	    }

	    canBid(creep, opts){
	        return !this.catalog.isFull(creep);
	    }

	    calculateAllocation(creep, opts){
	        return creep.carryCapacity;
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        if(opts.resource && job.resource != opts.resource){
	            return false;
	        }
	        if(!opts.minerals && job.resource != RESOURCE_ENERGY){
	            return false;
	        }
	        if(opts.types && !job.dropped && !_.includes(opts.types, job.target.structureType)){
	            return false;
	        }
	        if(opts.min > 0 && this.catalog.getResource(job.target, job.resource) < opts.min){
	            return false;
	        }
	        return 1 + this.getStorageOffset(creep) + distance / this.distanceWeight + this.calcAvailRatio(job, allocation);
	    }

	    processStep(creep, job, target, opts){
	        var result;
	        if(target.resourceType){
	            result = creep.pickup(target);
	        }else{
	            result = creep.withdraw(target, job.resource);
	        }
	        if(result == ERR_NOT_IN_RANGE){
	            creep.moveTo(target);
	        }else if(result == OK){
	            creep.memory.lastSource = target.id;
	        }
	    }

	}

	module.exports = PickupWorker;

/***/ },
/* 20 */
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
	        var energy = this.getEnergyOffset(creep);
	        if(energy < 0.75){
	            return distance / 100 + this.calcRepairOffset(job.target);
	        }
	        return energy + distance / 100 + this.calcRepairOffset(job.target);
	    }

	    calcRepairOffset(target){
	        var percent = target.hits / Math.min(target.hitsMax, Memory.settings.repairTarget);
	        if(percent < 0.5){
	            return -1 + percent;
	        }
	        return 0;
	    }

	    processStep(creep, job, target, opts){
	        if(creep.repair(target) == ERR_NOT_IN_RANGE){
	            creep.moveTo(target);
	        }
	    }

	}

	module.exports = RepairWorker;

/***/ },
/* 21 */
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
/* 22 */
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
/* 23 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var JobManager = __webpack_require__(24);

	var roomRegex = /([WE])(\d+)([NS])(\d+)/;

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

	    getResourceList(entity){
	        var result = {};
	        if(!entity){
	            return result;
	        }
	        if(entity.carryCapacity > 0){
	            return _.pick(entity.carry, amount => amount > 0);
	        }else if(entity.storeCapacity > 0){
	            return _.pick(entity.store, amount => amount > 0);
	        }else if(entity.energyCapacity > 0 && entity.energy > 0){
	            result[RESOURCE_ENERGY] = entity.energy;
	        }else if(entity.resourceType && entity.amount > 0){
	            result[entity.resourceType] = entity.amount;
	        }
	        return result;
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

	    notFull(entity){
	        return this.getAvailableCapacity(entity) > 0;
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

	    hasMinerals(entity){
	        return this.getStorage(entity) > this.getResource(entity, RESOURCE_ENERGY);
	    }

	    cacheRoomPos(pos){
	        console.log('cacheRoomPos', pos.roomName);
	        var roomParts = roomRegex.exec(pos.roomName);
	        if(!roomParts){
	            console.log('could not parse room', pos.roomName);
	            return false;
	        }
	        var north = roomParts[3] == 'N';
	        var east = roomParts[1] == 'E';
	        //     1    2    3     4
	        // /([WE])(\d+)([NS])(\d+)/
	        var xSign = east ? 1 : -1;
	        var ySign = north ? 1 : -1;
	        var xOffset = east ? 0 : 50;
	        var yOffset = north ? 50 : 0;
	        Memory.cache.roompos[pos.roomName] = {
	            x: _.parseInt(roomParts[2]) * 50 * xSign + xSign * xOffset,
	            y: _.parseInt(roomParts[4]) * 50 * ySign + yOffset,
	            ySign
	        };
	        return Memory.cache.roompos[pos.roomName];
	    }

	    calculateRealPosition(pos){
	        if(!Memory.cache){
	            Memory.cache = { roompos: {} };
	        }
	        var roompos = Memory.cache.roompos[pos.roomName];
	        if(!roompos){
	            roompos = this.cacheRoomPos(pos);
	        }
	        return {
	            x: roompos.x + pos.x,
	            y: roompos.y + pos.y * -roompos.ySign
	        };
	    }

	    getRealDistance(entityA, entityB){
	        if(!entityA.pos || !entityB.pos){
	            console.log('invalid positions', entityA, entityB);
	            return Infinity;
	        }
	        var posA = this.calculateRealPosition(entityA.pos);
	        var posB = this.calculateRealPosition(entityB.pos);
	        // console.log(entityA, entityA.pos.roomName, posA.x, posA.y, entityB, entityB.pos.roomName, posB.x, posB.y);
	        var distance = Math.max(Math.abs(posA.x - posB.x), Math.abs(posA.y-posB.y));
	        // console.log(posA.x - posB.x, posA.y-posB.y, distance);
	        return distance;
	    }
	}

	module.exports = Catalog;

/***/ },
/* 24 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var Jobs = __webpack_require__(25);

	class JobManager {
	    constructor(catalog){
	        this.catalog = catalog;
	        this.jobs = {};
	        this.openJobs = {};
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
	            // console.log(category.getType(), cap);
	            this.allocation[category.getType()] = 0;
	        });
	        if(Memory.debugJob){
	            _.forEach(this.jobs[Memory.debugJob], (job, type) => console.log(type, job.target, job.capacity));
	        }
	    }

	    allocate(){
	        _.forEach(Game.creeps, creep => this.addAllocation(creep.memory.jobType, creep.memory.jobId, creep.memory.jobAllocation));
	    }

	    getOpenJobs(type){
	        if(!this.openJobs[type]){
	            this.openJobs[type] = _.pick(this.jobs[type], job => job.allocated < job.capacity);
	        }
	        return this.openJobs[type];
	    }

	    getJob(type, id){
	        return _.get(this.jobs, [type, id], false);
	    }

	    addAllocation(type, jobId, allocation){
	        if(jobId && type && _.has(this.jobs, [type, jobId])){
	            _.set(this.jobs[type], [jobId, 'allocated'], _.get(this.jobs[type], [jobId, 'allocated'], 0) + allocation);
	            this.allocation[type] += allocation;
	            var job = _.get(this.jobs[type], jobId, false);
	            if(job && job.allocated >= job.capacity && _.has(this.openJobs, [type, jobId])){
	                delete this.openJobs[type][jobId];
	            }
	        }
	    }

	    removeAllocation(type, jobId, allocation){
	        if(jobId && type && _.has(this.jobs, [type, jobId])){
	            _.set(this.jobs[type], [jobId, 'allocated'], _.get(this.jobs[type], [jobId, 'allocated'], 0) - allocation);
	            this.allocation[type] -= allocation;
	            var job = _.get(this.jobs[type], jobId, false);
	            if(job && job.allocated < job.capacity && !_.has(this.openJobs, [type, jobId])){
	                this.openJobs[type] = _.pick(this.jobs[type], job => job.allocated < job.capacity);
	            }
	        }
	    }
	}

	module.exports = JobManager;

/***/ },
/* 25 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var Attack = __webpack_require__(26);
	var Build = __webpack_require__(28);
	var Defend = __webpack_require__(29);
	var Deliver = __webpack_require__(30);
	var Mine = __webpack_require__(31);
	var Idle = __webpack_require__(32);
	var Keep = __webpack_require__(33);
	var Observe = __webpack_require__(34);
	var Pickup = __webpack_require__(35);
	var Repair = __webpack_require__(36);
	var Reserve = __webpack_require__(37);
	var Upgrade = __webpack_require__(38);
	var Heal = __webpack_require__(39);

	module.exports = function(catalog){
	    return {
	        attack: new Attack(catalog),
	        build: new Build(catalog),
	        defend: new Defend(catalog),
	        deliver: new Deliver(catalog),
	        heal: new Heal(catalog),
	        idle: new Idle(catalog),
	        keep: new Keep(catalog),
	        mine: new Mine(catalog),
	        observe: new Observe(catalog),
	        pickup: new Pickup(catalog),
	        repair: new Repair(catalog),
	        reserve: new Reserve(catalog),
	        upgrade: new Upgrade(catalog)
	    };
	};

/***/ },
/* 26 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(27);

	class AttackJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'attack', { flagPrefix: 'Attack' }); }

	    calculateCapacity(room, target){
	        return 30;
	    }

	    generateTargets(room){
	        return this.catalog.getHostileCreeps(room);
	    }

	    generateJobsForFlag(flag){
	        if(flag.room){
	            var targets = _.filter(this.catalog.getHostileCreeps(flag.room), enemy => flag.pos.getRangeTo(enemy) <= Memory.settings.flagRange.attack);
	            return _.map(targets, target => this.generateJobForTarget(flag.room, target));
	        }
	        return [];
	    }
	}

	module.exports = AttackJob;



/***/ },
/* 27 */
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
	        return this.type+'-'+(entity.id || entity.name);
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
	        return this.postGenerate(jobs);
	    }

	    postGenerate(jobs){
	        return jobs;
	    }

	    generateJobs(room, flag){
	        return _.map(this.generateTargets(room, flag), target => this.finalizeJob(room, target, this.generateJobForTarget(room, target, flag)));
	    }

	    generateJobForTarget(room, target, flag){
	        return {
	            allocated: 0,
	            capacity: this.calculateCapacity(room, target, flag),
	            id: this.generateId(target),
	            target
	        };
	    }

	    finalizeJob(room, target, job){
	        return job;
	    }

	    generateJobsForFlag(flag){
	        if(!flag.room){
	            return [];
	        }
	        return this.generateJobs(flag.room, flag);
	    }

	    generateTargets(room, flag){
	        return [];
	    }

	}

	module.exports = BaseJob;

/***/ },
/* 28 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(27);

	class BuildJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'build'); }

	    calculateCapacity(room, target){
	        return Math.min(Math.ceil((target.progressTotal - target.progress)/5), 40);
	    }

	    generate(){
	        var jobs = {};
	        _.forEach(_.map(Game.constructionSites, target => this.generateJobForTarget(null, target)), job => jobs[job.id] = job);
	        return jobs;
	    }
	}

	module.exports = BuildJob;

/***/ },
/* 29 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(27);

	class DefendJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'defend', { flagPrefix: 'Defend' }); }

	    calculateCapacity(room, target){
	        return 100;
	    }

	    generateTargets(room){
	        _.set(Memory.stats.rooms, [room.name, 'hostileCount'], 0);
	        return this.catalog.getHostileCreeps(room);
	    }

	    finalizeJob(room, target, job){
	        job.keeper = _.get(target, 'owner.username', false) == 'Source Keeper';
	        if(!job.keeper){
	            Memory.stats.rooms[room.name].hostileCount++;
	        }
	        return job;
	    }
	}

	module.exports = DefendJob;



/***/ },
/* 30 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(27);

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
	    STRUCTURE_LINK,
	    STRUCTURE_TOWER
	];

	var mineralContainers = [
	    STRUCTURE_STORAGE,
	    STRUCTURE_CONTAINER,
	    STRUCTURE_TERMINAL
	];

	class DeliverJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'deliver', { flagPrefix: 'Mine' }); }

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
	                offset: this.getOffset(entity.structureType),
	                minerals: _.includes(mineralContainers, entity.structureType)
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
/* 31 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(27);

	class MineJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'mine', { flagPrefix: 'Mine' }); }

	    calculateCapacity(room, target){
	        if(target.mineralAmount > 0){
	            return 5;
	        }
	        //right now a mix of 6 and 7 capacity spawns means we underestimate the number of miners.
	        //so use 7 regardless of actual need
	        return 7;//Math.floor(target.energyCapacity/600)+1;
	    }

	    generateTargets(room, flag){
	        var targets = room.find(FIND_SOURCES);
	        var roomStats = Memory.stats.rooms[room.name];
	        if(roomStats && roomStats.extractor && roomStats.mineralAmount > 0){
	            var mineral = Game.getObjectById(roomStats.mineralId);
	            if(mineral && mineral.mineralAmount > 0){
	                targets.push(mineral);
	            }
	        }
	        // var hostiles = this.catalog.getHostileCreeps(room);
	        // targets = _.filter(targets, target => _.size(_.filter(hostiles, hostile => target.pos.getRangeTo(hostile) <= 10)) == 0);
	        if(flag && Memory.settings.flagRange[this.type] > 0){
	            return _.filter(targets, target => flag.pos.getRangeTo(target) <= Memory.settings.flagRange[this.type]);
	        }
	        return targets;
	    }
	}

	module.exports = MineJob;



/***/ },
/* 32 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(27);

	var types = {
	    spawn: 2,
	    worker: 1
	}

	class IdleJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'idle', { flagPrefix: 'Idle' }); }

	    generateJobs(room){
	        var target = _.first(this.catalog.getStructuresByType(room, STRUCTURE_SPAWN)) || room.controller;
	        var spots = _.map(types, (capacity, type) => {
	            return {
	                allocated: 0,
	                capacity: capacity,
	                id: this.generateId(target)+"-"+type,
	                target: target,
	                idleType: type
	            };
	        });
	        spots.push({
	            allocated: 0,
	            capacity: 4,
	            id: this.generateId(room.controller),
	            target: room.controller
	        });
	        return spots;
	    }

	    generateJobsForFlag(flag){
	        var parts = flag.name.split('-');
	        if(parts.length >= 3){
	            return [{
	                allocated: 0,
	                capacity: _.parseInt(parts[2]) || 1,
	                id: this.generateId(flag)+"-"+parts[1],
	                target: flag,
	                idleType: parts[1]
	            }];
	        }
	        if(parts.length == 2){
	            return [{
	                allocated: 0,
	                capacity: 4,
	                id: this.generateId(flag)+"-"+parts[1],
	                target: flag,
	                idleType: parts[1]
	            }];
	        }
	        return [];
	    }
	}

	module.exports = IdleJob;

/***/ },
/* 33 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(27);

	class KeepJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'keep', { flagPrefix: 'Keep' }); }

	    calculateCapacity(room, target){
	        if(target.ticksToSpawn > 60 && target.ticksToSpawn < 100){
	            return 15;
	        }else if(target.ticksToSpawn >= 100 && target.ticksToSpawn < 280){
	            return 0;
	        }
	        return 30;
	    }

	    generateTargets(room){
	        return [];
	    }

	    generateJobsForFlag(flag){
	        if(flag.room){
	            var keeps = flag.room.find(FIND_HOSTILE_STRUCTURES);
	            if(Memory.settings.flagRange.keep > 0){
	                keeps = _.filter(keeps, keep => flag.pos.getRangeTo(keep) <= Memory.settings.flagRange.keep);
	            }
	            return _.map(keeps, target => this.finalizeJob(flag.room, target, this.generateJobForTarget(flag.room, target)));
	        }else{
	            return [ this.generateJobForTarget(flag.room, flag) ];
	        }
	    }

	    finalizeJob(room, target, job){
	        if(target.ticksToSpawn > 0){
	            job.priority = target.ticksToSpawn/300;
	        }else{
	            job.priority = 0;
	        }
	        return job;
	    }
	}

	module.exports = KeepJob;



/***/ },
/* 34 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(27);

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
/* 35 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(27);

	var types = [
	    STRUCTURE_STORAGE,
	    STRUCTURE_CONTAINER,
	    STRUCTURE_LINK
	];

	class PickupJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'pickup', { flagPrefix: 'Pickup' }); }

	    generateJobs(room, flag){
	        var dropped = this.catalog.getDroppedResources(room);
	        var storage = _.filter(this.catalog.getStructuresByType(room, types), structure => this.catalog.getStorage(structure) > 0);
	        storage = storage.concat(dropped);
	        // var hostiles = this.catalog.getHostileCreeps(room);
	        // storage = _.filter(storage, target => _.size(_.filter(hostiles, hostile => target.pos.getRangeTo(hostile) <= 10)) == 0);
	        var result = [];
	        _.forEach(storage, (entity) => {
	            _.forEach(this.catalog.getResourceList(entity), (amount, type)=>{
	                if(entity.structureType == STRUCTURE_STORAGE && type != RESOURCE_ENERGY){
	                    return;
	                }
	                result.push({
	                    allocated: 0,
	                    capacity: amount,
	                    id: this.generateId(entity),
	                    target: entity,
	                    dropped: !!entity.resourceType,
	                    resource: type
	                });
	            });
	        }, []);
	        return result;
	    }
	}

	module.exports = PickupJob;

/***/ },
/* 36 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(27);

	class RepairJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'repair', { flagPrefix: 'Repair' }); }

	    calculateCapacity(room, target){
	        return Math.min(Math.ceil(Math.max(0, Math.min(target.hitsMax, Memory.settings.repairTarget) - target.hits)/100), 10);
	    }

	    // generate(){
	    //     var jobs = {};
	    //     var targets = _.filter(Game.structures, structure => structure.hits < Math.min(structure.hitsMax, Memory.settings.repairTarget));
	    //     _.forEach(_.map(targets, target => this.generateJobForTarget(null, target)), job => jobs[job.id] = job);
	    //     return jobs;
	    // }
	    generateTargets(room){
	        return _.filter(this.catalog.getStructures(room), structure => structure.hits < Math.min(structure.hitsMax, Memory.settings.repairTarget));
	    }

	    postGenerate(jobs){
	        _.forEach(Memory.repairBlacklist, target=>{
	            delete jobs[this.type+'-'+target];
	        });
	        return jobs;
	    }

	}

	module.exports = RepairJob;

/***/ },
/* 37 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(27);

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
/* 38 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(27);

	class UpgradeJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'upgrade', { flagPrefix: 'Upgrade' }); }
	    
	    calculateCapacity(room, target, flag){
	        var capacity = Memory.settings.upgradeCapacity || 10;
	        if(flag){
	            return capacity * 2;
	        }
	        return capacity;
	    }

	    generateTargets(room, flag){
	        return [room.controller];
	    }
	}

	module.exports = UpgradeJob;

/***/ },
/* 39 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(27);

	class HealJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'heal'); }

	    generate(){
	        var hurtCreeps = _.filter(Game.creeps, creep => creep.hits < creep.hitsMax);
	        return _.reduce(hurtCreeps, (result, creep) => {
	            var id = this.generateId(creep);
	            result[id] = {
	                allocated: 0,
	                capacity: 2,
	                id,
	                target: creep
	            }
	            return result;
	        }, {});
	    }
	}

	module.exports = HealJob;

/***/ },
/* 40 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var RoomUtil = __webpack_require__(2);

	class Misc {
	    static updateStats(catalog){
	        var stats = {
	            rooms: {}
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

/***/ }
/******/ ]);