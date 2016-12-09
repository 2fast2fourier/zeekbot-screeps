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
	var Behavior = __webpack_require__(19);
	var Catalog = __webpack_require__(20);
	var RoomUtil = __webpack_require__(2);

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
	                mineralAmount: _.get(mineral, 'mineralAmount', 0),
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
	        var damagedBuildings = _.filter(catalog.buildings[tower.room.name], structure => structure.hits < Math.min(structure.hitsMax, Memory.repairTarget) * Memory.settings.towerRepairPercent);
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
	var behaviors = __webpack_require__(5);

	class Spawner {

	    static mourn(){
	        for(var name in Memory.creeps) {
	            if(!Game.creeps[name]) {
	                delete Memory.creeps[name];
	            }
	        }
	    }

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
	        if(version.remote || category.remote){
	            //TODO fix additional support for remote types
	            // console.log(fullType);
	            return _.get(catalog.remoteTypeCount, fullType, 0) < version.ideal;
	        }
	        return Spawner.getSpawnCount(spawn, catalog, category, version, roomStats, className, fullType) > 0;
	    }

	    static getSpawnCount(spawn, catalog, category, version, roomStats, className, fullType){
	        var counts = catalog.getTypeCount(spawn.room);
	        var classCount = catalog.getClassCount(spawn.room);

	        var additional = Spawner.calculateAdditional(version, catalog, roomStats);
	        var ideal = _.get(version, 'ideal', 0);
	        var bootstrap = _.get(version, 'bootstrap', 0);

	        if(ideal > 0){
	            return Math.max(0, ideal + additional - _.get(counts, fullType, 0));
	        }else if(bootstrap > 0){
	            return Math.max(0, bootstrap + additional - _.get(classCount, className, 0));
	        }
	        return 0;
	    }

	    static calculateAdditional(version, catalog, roomStats){
	        if(version.additional){
	            var pass = _.reduce(version.additional, (result, requirement, name)=>{
	                if(name == 'count' || name == 'unless'){
	                    return result;
	                }
	                return result && roomStats[name] > requirement;
	            }, true);
	            if(pass){
	                return _.get(version.additional, 'count', 1);
	            }
	            return _.get(version.additional, 'unless', 0);
	        }
	        return 0;
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
	            if(disable.spawnCapacity > 0 && roomStats.spawn >= disable.spawnCapacity){
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
	        var typeCount = catalog.getTypeCount(spawn.room);
	        var deficits = {};
	        var deficitCount = {};
	        var deficit = 0;
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
	                        deficit += count;
	                    }
	                }
	            });
	        });
	        catalog.deficitCounts[spawn.room.name] = deficitCount;
	        catalog.deficits[spawn.room.name] = deficit;
	        return deficits;
	    }

	    static prepareSpawnMemory(category, version, fullType, className, versionName, catalog, spawn){
	        var memory = {
	            class: className,
	            type: fullType,
	            version: versionName,
	            behaviors: version.behaviors || category.behaviors,
	            traits: {},
	            action: false,
	            remote: version.remote || category.remote,
	            flag: version.flag || category.flag
	        };
	        
	        _.forEach(version.behaviors || category.behaviors, (data, name) => {
	            behaviors[name].setup(memory, data, catalog, spawn.room);
	        });

	        return memory;
	    }

	    static getCount(spawn, catalog, category, version, fullType){
	        if(version.remote || category.remote){
	            return _.get(catalog.remoteTypeCount, fullType, 0);
	        }
	        return _.get(catalog.getTypeCount(spawn.room), fullType, 0);
	    }

	    static processSpawn(spawn, catalog, startedSpawn){
	        var config = classConfig;
	        var deficits = Spawner.findCriticalDeficit(spawn, catalog);
	        var roomStats = Memory.stats.rooms[spawn.room.name];
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
	                        console.log(spawn.name, 'spawning', fullType, 'new count:', Spawner.getCount(spawn, catalog, category, version, fullType)+1, 'cost:', Spawner.calculateCost(version.parts));
	                        //HACK reset deficit count until next tick, so we don't accidentally interrupt any jobs
	                        catalog.deficits[spawn.room.name] = 0;
	                        catalog.deficitCounts[spawn.room.name] = {};
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
	            var version = _.get(config, ['versions', creep.memory.version || creep.memory.type.replace(creep.memory.class, '')], false);
	            if(!config || !version){
	                return;
	            }
	            creep.memory.behaviors = version.behaviors || config.behaviors;
	            creep.memory.traits = {};
	            creep.memory.action = false;
	            _.forEach(version.behaviors || config.behaviors, (data, name) => {
	                behaviors[name].setup(creep.memory, data, catalog, creep.room);
	            });
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

	function partList(args){
	    // var types = {work: WORK, carry: CARRY, move: MOVE, attack: ATTACK, tough: TOUGH};
	    // var prices = {work: 100, carry: 50, move: 50, attack: 80, tough: 10};
	    var parts = [];
	    _.forEach(args, (count, name)=>{
	        for(var iy=0;iy<count;iy++){
	            parts.push(name);
	        }
	    });
	    return parts;
	}

	module.exports = {
	    miner: {
	        versions: {
	            micro: {
	                ideal: 2,
	                critical: 900,
	                parts: {work: 6, carry: 2, move: 4}
	            },
	            nano: {
	                ideal: 2,
	                critical: 750,
	                disable: {
	                    spawnCapacity: 900
	                },
	                additional: {
	                    unless: 1,
	                    spawn: 900
	                },
	                parts: {work: 6, carry: 2, move: 1}
	            },
	            pano: {
	                bootstrap: 1,
	                critical: 500,
	                disable: {
	                    spawnCapacity: 750
	                },
	                additional: {
	                    unless: 3,
	                    spawn: 750
	                },
	                parts: {work: 4, carry: 1, move: 1}
	            },
	            pico: {
	                bootstrap: 1,
	                critical: 300,
	                parts: {work: 2, carry: 1, move: 1},
	                disable: {
	                    energy: 2000
	                },
	                additional: {
	                    unless: 1,
	                    spawn: 500
	                },
	                behaviors: {
	                    mining: {},
	                    deliver: { maxRange: 2, ignoreCreeps: true },
	                    drop: { priority: 10 },
	                    emergencydeliver: { }
	                }
	            },
	            remote: {
	                ideal: 2,
	                parts: {move: 4, work: 6, carry: 2},
	                requirements: {
	                    flag: 'Harvest', energy: 60000, flagClear: 10
	                },
	                behaviors: {
	                    mining: { flag: 'Harvest', maxRange: 5, approachFlag: true },
	                    deliver: { maxRange: 1, ignoreCreeps: true },
	                    drop: { priority: 1 }
	                },
	                remote: true
	            }
	        },
	        behaviors: {
	            mining: {},
	            deliver: { maxRange: 2, ignoreCreeps: true },
	            drop: { priority: 10 }
	        }
	    },
	    hauler: {
	        versions: {
	            spawn: {
	                ideal: 2,
	                critical: 600,
	                parts: {carry: 6, move: 6},
	                behaviors: {
	                    pickup: { containerTypes: [ STRUCTURE_CONTAINER, STRUCTURE_STORAGE, STRUCTURE_LINK ] },
	                    deliver: { containerTypes: [ STRUCTURE_EXTENSION, STRUCTURE_SPAWN ], ignoreCreeps: true }
	                }
	            },
	            nano: {
	                ideal: 2,
	                additional: {
	                    count: 2,
	                    upgradeDistance: 20
	                },
	                parts: {carry: 5, move: 5}
	            },
	            pico: {
	                bootstrap: 2,
	                critical: 200,
	                disable: {
	                    spawnCapacity: 500
	                },
	                parts: {carry: 2, move: 2}
	            },
	            remote: {
	                ideal: 4,
	                parts: {move: 5, carry: 10},
	                remote: true,
	                requirements: {
	                    flag: 'Collect', energy: 60000, flagClear: 20
	                },
	                disable: {
	                    energy: 500000
	                },
	                behaviors: {
	                    pickup: { flag: 'Collect', containerTypes: [ STRUCTURE_CONTAINER, STRUCTURE_STORAGE ] },
	                    deliver: { flag: 'Dropoff', ignoreCreeps: true, containerTypes: [ STRUCTURE_STORAGE ], maxStorage: 500000 }
	                },
	            }
	        },
	        behaviors: {
	            pickup: { containerTypes: [ STRUCTURE_CONTAINER, STRUCTURE_STORAGE ] },
	            deliver: {
	                ignoreClass: [ 'hauler', 'miner', 'extractor', 'tender' ],
	                containerTypes: [ STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_SPAWN ]
	            }
	        }
	    },
	    worker: {
	        versions: {
	            micro: {
	                ideal: 1,
	                additional: {
	                    count: 1,
	                    buildHits: 1000
	                },
	                parts: {work: 4, carry: 2, move: 6}
	            },
	            nano: {
	                ideal: 1,
	                disable: {
	                    spawnCapacity: 800
	                },
	                additional: {
	                    count: 1,
	                    buildHits: 1000
	                },
	                parts: {work: 2, carry: 2, move: 4}
	            },
	            pico: {
	                bootstrap: 1,
	                additional: {
	                    count: 1,
	                    buildHits: 1000
	                },
	                parts: {work: 1, carry: 2, move: 2}
	            },
	            repair: {
	                ideal: 1,
	                requirements: {
	                    repairHits: 10000 
	                },
	                additional: {
	                    count: 1,
	                    repairHits: 20000
	                },
	                parts: {work: 4, carry: 2, move: 4},
	                behaviors: { pickup: {}, repair: {}, emergencydeliver: {} }
	            },
	            picorepair: {
	                ideal: 1,
	                disable: {
	                    spawnCapacity: 700
	                },
	                additional: {
	                    count: 1,
	                    repairHits: 10000
	                },
	                parts: {work: 2, carry: 2, move: 4},
	                behaviors: { pickup: {}, repair: {}, emergencydeliver: {} }
	            },
	            upgrade: {
	                ideal: 1,
	                additional: {
	                    count: 1,
	                    energy: 25000
	                },
	                parts: {work: 8, carry: 2, move: 3},
	                behaviors: { pickup: {}, upgrade: {}, emergencydeliver: {} }
	            },
	            nanoupgrade: {
	                ideal: 3,
	                disable: {
	                    spawnCapacity: 850
	                },
	                parts: {work: 6, carry: 2, move: 2},
	                behaviors: { pickup: {}, upgrade: {}, emergencydeliver: {} }
	            },
	            picoupgrade: {
	                ideal: 2,
	                disable: {
	                    spawnCapacity: 600
	                },
	                parts: {work: 4, carry: 2, move: 1},
	                behaviors: { pickup: {}, upgrade: {}, emergencydeliver: {} }
	            },
	            remote: {
	                ideal: 1,
	                requirements: {
	                    flag: 'Work'
	                },
	                behaviors: {
	                    pickup: { flag: 'Work', energy: 60000, flagClear: 20 },
	                    emergencydeliver: {},
	                    build: {},
	                    repair: { priority: 2 }
	                },
	                remote: true,
	                parts: {move: 6, work: 4, carry: 2}
	            },
	            remoteupgrade: {
	                ideal: 2,
	                requirements: {
	                    flag: 'Upgrade', energy: 60000, flagClear: 20
	                },
	                parts: {work: 6, carry: 4, move: 3},
	                behaviors: { pickup: {}, upgrade: { flag: 'Upgrade' }, emergencydeliver: {} },
	                remote: true
	            },
	            remoterepair: {
	                ideal: 1,
	                requirements: {
	                    flag: 'Repair', energy: 60000, flagClear: 20
	                },
	                parts: {move: 4, work: 2, carry: 2},
	                behaviors: { pickup: {}, repair: { flag: 'Repair' }, emergencydeliver: {} },
	                remote: true
	            }
	        },
	        behaviors: {
	            pickup: {},
	            emergencydeliver: {},
	            build: { priority: 1, ideal: 2 },
	            repair: { priority: 2 },
	            upgrade: { priority: 3 }
	        }
	    },
	    extractor: {
	        versions: {
	            micro: {
	                ideal: 1,
	                requirements: {
	                    extractor: true,
	                    mineralAmount: 1
	                },
	                parts: {work: 10, carry: 2, move: 6}
	            }
	        },
	        behaviors: {
	            extract: {},
	            deliver: { maxRange: 3, ignoreCreeps: true, containerTypes: [ STRUCTURE_STORAGE, STRUCTURE_CONTAINER ] },
	            drop: { priority: 10 }
	        }
	    },
	    tender: {
	        versions: {
	            nano: {
	                ideal: 1,
	                parts: {carry: 6, move: 6},
	                requirements: {
	                    extractor: true,
	                    mineralAmount: 1
	                }
	            },
	            energy: {
	                ideal: 1,
	                parts: {carry: 4, move: 4},
	                requirements: {
	                    extractor: true
	                },
	                disable: {
	                    terminalEnergy: 20000
	                },
	                behaviors: {
	                    pickup: { containerTypes: [ STRUCTURE_STORAGE ] },
	                    deliver: { containerTypes: [ STRUCTURE_TERMINAL ], ignoreCreeps: true, maxStorage: 20000 },
	                    emergencydeliver: {}
	                }
	            }
	        },
	        behaviors: {
	            pickup: { mineral: true, containerTypes: [ STRUCTURE_CONTAINER ] },
	            deliver: { containerTypes: [ STRUCTURE_TERMINAL, STRUCTURE_STORAGE ], ignoreCreeps: true }
	        }
	    },
	    keepminer: {
	        versions: {
	            a1: {
	                ideal: 1,
	                parts: {move: 4, work: 7, carry: 2},
	                requirements: { flag: 'Keep-1-Mine', energy: 60000, flagClear: 10 },
	                flag: 'Keep-1-Mine'
	            },
	            a2: {
	                ideal: 1,
	                parts: {move: 4, work: 7, carry: 2},
	                requirements: { flag: 'Keep-2-Mine', energy: 60000, flagClear: 10 },
	                flag: 'Keep-2-Mine'
	            }
	        },
	        behaviors: {
	            mining: { flag: true, maxRange: 10, approachFlag: true },
	            deliver: { maxRange: 1, ignoreCreeps: true },
	            drop: { priority: 1 }
	        },
	        remote: true
	    },
	    keepfighter: {
	        versions: {
	            a1: {
	                ideal: 2,
	                parts: {tough: 17, move: 16, attack: 15},
	                requirements: { flag: 'Keep-1' },
	                flag: 'Keep-1'
	            },
	            a2: {
	                ideal: 2,
	                parts: {tough: 17, move: 16, attack: 15},
	                requirements: { flag: 'Keep-2' },
	                flag: 'Keep-2'
	            }
	        },
	        behaviors: { attack: { flag: true, maxRange: 10 } },
	        remote: true
	    },
	    fighter: {
	        versions: {
	            ranged: {
	                ideal: 2,
	                requirements: {
	                    flag: 'Defend'
	                },
	                parts: {tough: 10, move: 10, ranged_attack: 10},
	                behaviors: { attack: { flag: 'Defend', maxRange: 10, ranged: true } },
	                remote: true
	            },
	            nano: {
	                ideal: 1,
	                requirements: {
	                    flag: 'Assault'
	                },
	                parts: {tough: 17, move: 16, attack: 15},
	                behaviors: { attack: { flag: 'Assault', maxRange: 10 } },
	                remote: true
	            }
	        },
	        behaviors: { attack: { flag: 'Attack' }, defend: { flag: 'Base' } }
	    },
	    healer: {
	        versions: {
	            pico: {
	                ideal: 2,
	                requirements: {
	                    flag: 'Heal',
	                    energy: 25000,
	                    flagClear: 25
	                },
	                parts: {tough: 4, move: 8, heal: 4},
	                remote: true
	            }
	        },
	        behaviors: { heal: { flag: 'Heal' } }
	    },
	    claimer: {
	        versions: {
	            pico: {
	                ideal: 1,
	                requirements: {
	                    flag: 'Reserve'
	                },
	                parts: {move: 2, claim: 2},
	                remote: true
	            }
	        },
	        behaviors: { claim: { flag: 'Claim' }, reserve: { flag: 'Reserve' } }
	    }
	};

/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var { BaseBehavior } = __webpack_require__(6);

	class NOP extends BaseBehavior {
	    constructor(){ super('none'); }
	};

	var { ClaimBehavior, ReserveBehavior } = __webpack_require__(7);

	var Attack = __webpack_require__(8);
	var Build = __webpack_require__(9);
	var Deliver = __webpack_require__(10);
	var Drop = __webpack_require__(11);
	var EmergencyDeliver = __webpack_require__(12);
	var Extract = __webpack_require__(13);
	var Heal = __webpack_require__(14);
	var Mining = __webpack_require__(15);
	var Repair = __webpack_require__(16);
	var Upgrade = __webpack_require__(17);
	var Pickup = __webpack_require__(18);

	module.exports = {
	    attack: new Attack(),
	    defend: new NOP(),
	    build: new Build(),
	    emergencydeliver: new EmergencyDeliver(),
	    extract: new Extract(),
	    deliver: new Deliver(),
	    drop: new Drop(),
	    heal: new Heal(),
	    mining: new Mining(),
	    repair: new Repair(),
	    upgrade: new Upgrade(),
	    claim: new ClaimBehavior(),
	    reserve: new ReserveBehavior(),
	    pickup: new Pickup()
	}

/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var RoomUtil = __webpack_require__(2);

	class BaseBehavior {
	    constructor(type){
	        this.type = type;
	    }

	    stillValid(creep, data, catalog){ return creep.memory.traits[this.type] && !!this.target(creep); }
	    bid(creep, data, catalog){ return false; }
	    start(creep, data, catalog){ return false; }
	    process(creep, data, catalog){ }

	    end(creep, data, catalog){
	        delete creep.memory.traits[this.type];
	    }

	    target(creep){
	        return Game.getObjectById(creep.memory.traits[this.type]);
	    }

	    trait(creep){
	        return creep.memory.traits[this.type];
	    }

	    exists(creep){
	        return !!this.target(creep);
	    }

	    setTrait(creep, trait){
	        if(trait === false){
	            delete creep.memory.traits[this.type];
	        }else{
	            creep.memory.traits[this.type] = trait;
	        }
	    }

	    setup(memory, data, catalog, room){ }
	}

	class RemoteBaseBehavior extends BaseBehavior {
	    constructor(type){ super(type); }

	    getFlag(creep, data){
	        if(data.flag === true){
	            return Game.flags[creep.memory.flag];
	        }
	        return Game.flags[data.flag];
	    }

	    stillValid(creep, data, catalog){
	        if(this.exists(creep)){
	            return false;
	        }
	        var flag = this.getFlag(creep, data);
	        if(flag && (creep.pos.roomName != flag.pos.roomName || RoomUtil.onEdge(creep.pos))){
	            return true;
	        }
	        if(flag && data.approachFlag && creep.pos.getRangeTo(flag) >= data.maxRange){
	            return true;
	        }
	        return false;
	    }
	    bid(creep, data, catalog){
	        var flag = this.getFlag(creep, data);
	        if(flag && creep.pos.roomName == flag.pos.roomName && data.approachFlag && creep.pos.getRangeTo(flag) >= data.maxRange){
	            return true;
	        }
	        return flag && creep.pos.roomName != flag.pos.roomName;
	    }
	    start(creep, data, catalog){
	        var flag = this.getFlag(creep, data);
	        if(flag && creep.pos.roomName == flag.pos.roomName && data.approachFlag && creep.pos.getRangeTo(flag) >= data.maxRange){
	            return true;
	        }
	        return flag && creep.pos.roomName != flag.pos.roomName;
	    }
	    process(creep, data, catalog){
	        if(this.exists(creep)){
	            return false;
	        }
	        var flag = this.getFlag(creep, data);
	        if(flag && (creep.pos.roomName != flag.pos.roomName || RoomUtil.onEdge(creep.pos))){
	            creep.moveTo(flag);
	            return true;
	        }
	        if(flag && data.approachFlag && creep.pos.getRangeTo(flag) >= data.maxRange){
	            creep.moveTo(flag);
	            return true;
	        }
	        return false;
	    }
	}

	class BaseFlagBehavior extends RemoteBaseBehavior {

	    stillValid(creep, data, catalog){
	        return !!this.getFlag(creep, data);
	    }

	    bid(creep, data, catalog){
	        return !!this.getFlag(creep, data);
	    }

	    start(creep, data, catalog){
	        return !!this.getFlag(creep, data);
	    }

	    process(creep, data, catalog){ }

	    end(creep, data, catalog){ }

	    setup(memory, data, catalog, room){ }
	};

	module.exports = {
	    BaseBehavior,
	    RemoteBaseBehavior,
	    BaseFlagBehavior
	};

/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var RoomUtil = __webpack_require__(2);
	var { BaseFlagBehavior } = __webpack_require__(6);

	class ReserveBehavior extends BaseFlagBehavior {

	    process(creep, data, catalog){
	        var claimFlag = Game.flags[data.flag];
	        if(claimFlag){
	            if(creep.pos.roomName != claimFlag.pos.roomName){
	                creep.moveTo(claimFlag);
	            }else{
	                var result = creep.reserveController(creep.room.controller);
	                if(result == ERR_NOT_IN_RANGE){
	                    creep.moveTo(creep.room.controller);
	                }
	            }
	        }
	    }
	};

	class ClaimBehavior extends BaseFlagBehavior {

	    process(creep, data, catalog){
	        var claimFlag = Game.flags[data.flag];
	        if(claimFlag){
	            if(creep.pos.roomName != claimFlag.pos.roomName){
	                creep.moveTo(claimFlag);
	            }else{
	                var result = creep.claimController(creep.room.controller);
	                if(result == ERR_NOT_IN_RANGE){
	                    creep.moveTo(creep.room.controller);
	                }else if(result == OK){
	                    console.log("Claimed room", creep.pos.roomName);
	                    claimFlag.remove();
	                }
	            }
	        }
	    }
	};

	module.exports = {
	    ClaimBehavior,
	    ReserveBehavior
	}

/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var RoomUtil = __webpack_require__(2);
	var { BaseBehavior } = __webpack_require__(6);

	class AttackBehavior extends BaseBehavior {

	    stillValid(creep, data, catalog){
	        return true;
	    }

	    bid(creep, data, catalog){
	        return 0;
	    }

	    start(creep, data, catalog){
	        return true;
	    }

	    process(creep, data, catalog){
	        var sayings = ['~biff~', 'bam!', 'zing'];
	        var hostiles = catalog.getHostileCreeps(creep.room);
	        if(data.maxRange > 0 || creep.hits < creep.hitsMax){
	            var range = data.maxRange;
	            if(creep.hits < creep.hitsMax){
	                range = 10;
	            }
	            hostiles = _.filter(hostiles, hostile => creep.pos.getRangeTo(hostile) < data.maxRange);
	        }
	        // var hostileStructures = catalog.getHostileStructures(creep.room);
	        var targetFlag;
	        if(data.flag === true){
	            targetFlag = Game.flags[creep.memory.flag];
	        }else{
	            targetFlag = Game.flags[_.get(Memory, 'targetFlag', _.get(data, 'flag', 'Base'))];
	        }
	        if(!targetFlag){
	            targetFlag = Game.flags['Base'];
	        }
	        var manualTarget = _.get(Memory, 'manualTarget', false);
	        var target = false;
	        if(targetFlag && (creep.pos.roomName != targetFlag.pos.roomName || (hostiles.length < 1 && !manualTarget))){
	            if(creep.pos.getRangeTo(targetFlag) > 2){
	                creep.moveTo(targetFlag);
	            }
	        }else if(manualTarget){
	            target = Game.getObjectById(manualTarget);
	            if(!target){
	                Memory.manualTarget = false;
	            }
	        }else if(hostiles.length > 0){
	            var enemies = _.sortBy(hostiles, (target)=>creep.pos.getRangeTo(target));
	            target = enemies[0];
	        }
	        // else if(hostileStructures.length > 0){
	        //     var enemies = _.sortBy(hostileStructures, (target)=>creep.pos.getRangeTo(target));
	        //     target = enemies[0];
	        //     // console.log(target);
	        // }
	        if(data.ranged && creep.pos.getRangeTo(target) < 2){// && RoomUtil.intactPartCount('move') > 0){
	            creep.move((creep.pos.getDirectionTo(target)+4)%8);
	        }
	        if(target){
	            var result;
	            if(data.ranged){
	                result = creep.rangedAttack(target);
	            }else{
	                result = creep.attack(target);
	            }
	            if(result == ERR_NOT_IN_RANGE) {
	                creep.moveTo(target);
	            }else if(result == OK){
	                creep.say(sayings[Math.floor(Math.random()*sayings.length)]);
	            }
	        }
	    }
	};

	module.exports = AttackBehavior;

/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var RoomUtil = __webpack_require__(2);
	var { RemoteBaseBehavior } = __webpack_require__(6);

	class BuildBehavior extends RemoteBaseBehavior {
	    constructor(){ super('build'); }

	    stillValid(creep, data, catalog){
	        return creep.carry.energy > 0 && RoomUtil.exists(creep.memory.traits.build);
	    }

	    bid(creep, data, catalog){
	        var ideal = data.ideal || 0;
	        var jobsActive = _.get(catalog.traitCount, 'build', 0);
	        var jobPriority = 0;
	        var energy = creep.carry.energy / creep.carryCapacity;
	        if(jobsActive < ideal){
	            jobPriority = (jobsActive-ideal)*11;
	        }
	        var constructionSites = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
	        if(constructionSites.length > 0 && RoomUtil.getEnergy(creep) > 0){
	            return (1 - energy) + (data.priority || 0) + jobPriority*energy;
	        }else{
	            return false;
	        }
	    }

	    start(creep, data, catalog){
	        var constructionSites = _.sortBy(creep.room.find(FIND_MY_CONSTRUCTION_SITES), site => creep.pos.getRangeTo(site)/50 + (1 - site.progress / site.progressTotal));
	        this.setTrait(creep, _.get(constructionSites, '[0].id', false));
	        creep.say('building');
	        return RoomUtil.exists(this.trait(creep));
	    }

	    process(creep, data, catalog){
	        var target = this.target(creep);
	        if(target && creep.build(target) == ERR_NOT_IN_RANGE) {
	            creep.moveTo(target);
	        }
	    }
	};

	module.exports = BuildBehavior;

/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var RoomUtil = __webpack_require__(2);
	var { RemoteBaseBehavior } = __webpack_require__(6);


	class DeliverBehavior extends RemoteBaseBehavior {
	    constructor(){ super('deliver'); };

	    stillValid(creep, data, catalog){
	        var storage = RoomUtil.getStorage(creep);
	        if(storage > 0 && super.stillValid(creep, data, catalog)){
	            return true;
	        }
	        var target = this.target(creep);
	        if(data.maxRange && creep.pos.getRangeTo(target) > data.maxRange){
	            return false;
	        }
	        if(storage == 0 || target == null){
	            return false;
	        }else{
	            return RoomUtil.getStoragePercent(target) < 0.85 && target.pos.roomName == creep.pos.roomName;
	        }
	    }

	    bid(creep, data, catalog){
	        var storage = RoomUtil.getStoragePercent(creep);
	        if(storage > 0.1 && super.bid(creep, data, catalog)){
	            return 1-storage;
	        }
	        var deliverable = catalog.getEnergyNeeds(creep, data);
	        if(deliverable.length > 0 && RoomUtil.getStorage(creep) > 0){
	            return (0.5 - storage) + (data.priority || 0) + (creep.pos.getRangeTo(deliverable[0])/25) + (RoomUtil.getStoragePercent(deliverable[0]));
	        }else{
	            return false;
	        }
	    }

	    start(creep, data, catalog){
	        if(super.start(creep, data, catalog)){
	            return true;
	        }
	        var deliverable = catalog.getEnergyNeeds(creep, data);
	        if(deliverable.length > 0){
	            this.setTrait(creep, deliverable[0].id);
	            return this.exists(creep);
	        }else{
	            return false;
	        }
	    }

	    process(creep, data, catalog){
	        if(super.process(creep, data, catalog)){
	            return;
	        }
	        var target = this.target(creep);
	        var transferred = false;
	        _.forEach(creep.carry, (count, type) =>{
	            if(!transferred && count > 0){
	                var result = creep.transfer(target, type);
	                transferred = result == OK;
	                if(result == ERR_NOT_IN_RANGE) {
	                    creep.moveTo(target);
	                    transferred = true;
	                }
	            }
	        });
	    }
	};

	module.exports = DeliverBehavior;

/***/ },
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var RoomUtil = __webpack_require__(2);
	var { BaseBehavior } = __webpack_require__(6);

	class DropBehavior extends BaseBehavior {
	    constructor(){ super('drop'); }

	    stillValid(creep, data, catalog){
	        return RoomUtil.getStoragePercent(creep) > 0.75;
	    }

	    bid(creep, data, catalog){
	        return 1 - RoomUtil.getStoragePercent(creep) + _.get(data, 'priority', 0);
	    }

	    start(creep, data, catalog){
	        return true;
	    }

	    process(creep, data, catalog){
	        var dropped = false;
	        _.forEach(creep.carry, (count, type) =>{
	            if(!dropped && count > 0){
	                var result = creep.drop(type);
	                dropped = result == OK;
	            }
	        });
	    }
	};

	module.exports = DropBehavior;

/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var RoomUtil = __webpack_require__(2);
	var { BaseBehavior } = __webpack_require__(6);

	class EmergencyDeliver extends BaseBehavior {
	    constructor(){ super('emergencydeliver'); };

	    stillValid(creep, data, catalog){
	        var target = this.target(creep);
	        return target && creep.carry.energy > 0 && RoomUtil.getEnergyPercent(target) < 0.9;
	    }

	    bid(creep, data, catalog){
	        if(RoomUtil.getEnergyPercent(creep) > 0.25 && _.get(catalog.deficits, creep.pos.roomName, 0) > 0){
	            return -999;
	        }
	        return false;
	    }

	    start(creep, data, catalog){
	        var opts = {
	            ignoreCreeps: true,
	            containerTypes: [
	                STRUCTURE_EXTENSION,
	                STRUCTURE_SPAWN
	            ]
	        };
	        var deliverable = catalog.getEnergyNeeds(creep, opts);
	        this.setTrait(creep, _.get(deliverable, '[0].id', false));
	        return this.exists(creep);
	    }

	    process(creep, data, catalog){
	        var target = this.target(creep);
	        var result = creep.transfer(target, RESOURCE_ENERGY);
	        if(result == ERR_NOT_IN_RANGE) {
	            creep.moveTo(target);
	        }
	    }
	}

	module.exports = EmergencyDeliver;

/***/ },
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var RoomUtil = __webpack_require__(2);
	var { RemoteBaseBehavior } = __webpack_require__(6);

	class ExtractBehavior extends RemoteBaseBehavior {
	    constructor(){ super('extract'); }

	    stillValid(creep, data, catalog){
	        if(super.stillValid(creep, data, catalog)){
	            return true;
	        }
	        return _.sum(creep.carry) < creep.carryCapacity && this.exists(creep) && RoomUtil.getStat(creep.room, 'extractor', false);
	    }

	    bid(creep, data, catalog){
	        if(super.bid(creep, data, catalog)){
	            return -999;
	        }
	        var minerals = creep.room.find(FIND_MINERALS);
	        if(!RoomUtil.getStat(creep.room, 'extractor', false) || _.sum(creep.carry) >= creep.carryCapacity || minerals.length == 0){
	            return false;
	        }
	        return _.sum(creep.carry) / creep.carryCapacity + (data.priority || 0);
	    }

	    start(creep, data, catalog){
	        if(super.start(creep, data, catalog)){
	            return true;
	        }

	        var minerals = creep.room.find(FIND_MINERALS);

	        this.setTrait(creep, _.get(minerals, '[0].id'));
	        
	        return this.exists(creep);
	    }

	    process(creep, data, catalog){
	        if(super.process(creep, data, catalog)){
	            return;
	        }
	        var source = this.target(creep);
	        if(source && creep.harvest(source) == ERR_NOT_IN_RANGE) {
	            creep.moveTo(source);
	        }
	    }
	};

	module.exports = ExtractBehavior;

/***/ },
/* 14 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var RoomUtil = __webpack_require__(2);
	var { BaseBehavior } = __webpack_require__(6);

	class HealBehavior extends BaseBehavior {

	    stillValid(creep, data, catalog){
	        return true;
	    }

	    bid(creep, data, catalog){
	        return 0;
	    }

	    start(creep, data, catalog){
	        return true;
	    }

	    process(creep, data, catalog){
	        var patients = _.filter(catalog.getCreeps(creep.room), patient => patient.hits < patient.hitsMax);
	        var targetFlag = Game.flags[_.get(Memory, 'targetFlag', _.get(data, 'flag', 'Base'))];
	        if(!targetFlag){
	            targetFlag = Game.flags['Base'];
	        }
	        var target = false;
	        if(targetFlag && (creep.pos.roomName != targetFlag.pos.roomName || (patients.length < 1))){
	            if(creep.pos.getRangeTo(targetFlag) > 1){
	                creep.moveTo(targetFlag);
	            }
	        }else if(patients.length > 0){
	            var targets = _.sortBy(patients, (target)=>creep.pos.getRangeTo(target));
	            target = targets[0];
	        }
	        if(target){
	            var result = creep.heal(target);
	            if(result == ERR_NOT_IN_RANGE) {
	                creep.moveTo(target);
	                creep.rangedHeal(target)
	            }else if(result == OK){
	                creep.say('beyoop');
	            }
	        }
	    }
	};

	module.exports = HealBehavior;

/***/ },
/* 15 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var RoomUtil = __webpack_require__(2);
	var { RemoteBaseBehavior } = __webpack_require__(6);

	class MiningBehavior extends RemoteBaseBehavior {
	    constructor(){ super('mining'); }

	    stillValid(creep, data, catalog){
	        if(super.stillValid(creep, data, catalog)){
	            return true;
	        }
	        return creep.carry.energy < creep.carryCapacity - 10 && this.exists(creep);
	    }

	    bid(creep, data, catalog){
	        if(super.bid(creep, data, catalog)){
	            return -999;
	        }
	        if(creep.carry.energy >= creep.carryCapacity){
	            return false;
	        }
	        return creep.carry.energy / creep.carryCapacity + (data.priority || 0);
	    }

	    start(creep, data, catalog){
	        if(super.start(creep, data, catalog)){
	            return true;
	        }
	        if(creep.memory.lastSource && RoomUtil.exists(creep.memory.lastSource)){
	            this.setTrait(creep, creep.memory.lastSource);
	        }else if(data.maxRange > 0){
	            this.setTrait(creep, _.get(RoomUtil.getNearestSource(creep, data.maxRange), 'id', null));
	        }else{
	            this.setTrait(creep, RoomUtil.findFreeMiningId(creep.room, creep, catalog));
	        }
	        
	        return this.exists(creep);
	    }

	    process(creep, data, catalog){
	        if(super.process(creep, data, catalog)){
	            return;
	        }
	        var source = this.target(creep);
	        if(source && creep.harvest(source) == ERR_NOT_IN_RANGE) {
	            creep.moveTo(source);
	        }
	    }

	    end(creep, data, catalog){
	        creep.memory.lastSource = this.trait(creep);
	        super.end(creep, data, catalog);
	    }
	};

	module.exports = MiningBehavior;

/***/ },
/* 16 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var RoomUtil = __webpack_require__(2);
	var { RemoteBaseBehavior } = __webpack_require__(6);

	class RepairBehavior extends RemoteBaseBehavior {
	    constructor(){ super('repair'); }

	    stillValid(creep, data, catalog){
	        if(super.stillValid(creep, data, catalog)){
	            return true;
	        }
	        var target = Game.getObjectById(creep.memory.traits.repair);
	        return creep.carry.energy > 0 && target && target.hits < target.hitsMax && target.hits < Memory.repairTarget;
	    }

	    bid(creep, data, catalog){
	        if(super.bid(creep, data, catalog)){
	            return -999;
	        }
	        var ideal = data.ideal || 0;
	        var repairsActive = _.get(catalog.traitCount, 'repair', 0);
	        var jobPriority = 0;
	        var energy = creep.carry.energy / creep.carryCapacity;
	        if(repairsActive < ideal){
	            jobPriority = (repairsActive-ideal)*11;
	        }
	        var repairable = _.filter(catalog.buildings[creep.pos.roomName], building => building.hits < building.hitsMax && building.hits < Memory.repairTarget);
	        if(repairable.length > 0 && RoomUtil.getEnergy(creep) > 0){
	            return (1 - energy) + (data.priority || 0) + jobPriority*energy;
	        }else{
	            return false;
	        }
	    }

	    start(creep, data, catalog){
	        if(super.start(creep, data, catalog)){
	            return true;
	        }
	        var repairable = _.sortBy(_.filter(catalog.buildings[creep.pos.roomName], building => building.hits < building.hitsMax && building.hits < Memory.repairTarget),
	                                  (target)=>target.hits / Math.min(target.hitsMax, Memory.repairTarget) + creep.pos.getRangeTo(target)/100);
	        if(repairable.length > 0){
	            creep.memory.traits.repair = repairable[0].id;
	            creep.say('repair');
	            return RoomUtil.exists(creep.memory.traits.repair);
	        }else{
	            return false;
	        }
	    }

	    process(creep, data, catalog){
	        if(super.process(creep, data, catalog)){
	            return true;
	        }
	        var target = Game.getObjectById(creep.memory.traits.repair);
	        if(target && creep.repair(target) == ERR_NOT_IN_RANGE) {
	            creep.moveTo(target);
	        }
	    }
	};

	module.exports = RepairBehavior;

/***/ },
/* 17 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var RoomUtil = __webpack_require__(2);
	var { RemoteBaseBehavior } = __webpack_require__(6);

	class UpgradeBehavior extends RemoteBaseBehavior {
	    constructor(){ super('upgrade'); }

	    stillValid(creep, data, catalog){
	        if(super.stillValid(creep, data, catalog)){
	            return true;
	        }
	        return creep.carry.energy > 0 && creep.room.controller && creep.room.controller.my;
	    }

	    bid(creep, data, catalog){
	        if(super.bid(creep, data, catalog)){
	            return -999;
	        }
	        var ideal = data.ideal || 0;
	        var upgradersActive = _.get(catalog.traitCount, 'upgrade', 0);
	        var jobPriority = 0;
	        var energy = creep.carry.energy / creep.carryCapacity;
	        if(upgradersActive < ideal){
	            jobPriority = (upgradersActive-ideal)*11;
	        }
	        if(creep.room.controller && creep.room.controller.my && RoomUtil.getEnergy(creep) > 0){
	            return (1 - energy) + (data.priority || 0) + jobPriority*energy;
	        }else{
	            return false;
	        }
	    }

	    start(creep, data, catalog){
	        if(super.start(creep, data, catalog)){
	            return true;
	        }
	        creep.say('upgrading');
	        creep.memory.traits.upgrade = true;
	        return creep.room.controller.my && RoomUtil.getEnergy(creep) > 0;
	    }

	    process(creep, data, catalog){
	        if(super.process(creep, data, catalog)){
	            return;
	        }
	        if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
	            creep.moveTo(creep.room.controller);
	        }
	    }
	};

	module.exports = UpgradeBehavior;

/***/ },
/* 18 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var RoomUtil = __webpack_require__(2);
	var { RemoteBaseBehavior } = __webpack_require__(6);

	class PickupBehavior extends RemoteBaseBehavior {
	    constructor(){ super('pickup'); }

	    stillValid(creep, data, catalog){
	        if(super.stillValid(creep, data, catalog)){
	            return true;
	        }
	        var target = this.target(creep);
	        var storage;
	        if(creep.memory.mineralType){
	            storage = RoomUtil.getResource(target, creep.memory.mineralType);
	        }else{
	            storage = RoomUtil.getEnergy(target);
	        }
	        return target && target.pos.roomName == creep.pos.roomName && storage > 0 && RoomUtil.getStoragePercent(creep) < 0.9;
	    }

	    bid(creep, data, catalog){
	        var storage = RoomUtil.getStoragePercent(creep);
	        if(storage < 0.2 && super.bid(creep, data, catalog)){
	            return storage;
	        }
	        var targets;
	        if(creep.memory.mineralType){
	            targets = catalog.getResourceContainers(creep, creep.memory.mineralType, data.containerTypes);
	        }else{
	            targets = catalog.getEnergyContainers(creep, data.containerTypes);
	        }
	        if(storage > 0.5 || !targets.length){
	            return false;
	        }
	        return storage + creep.pos.getRangeTo(targets[0])/50;
	    }

	    start(creep, data, catalog){
	        if(super.start(creep, data, catalog)){
	            return true;
	        }
	        if(creep.memory.mineralType){
	            this.setTrait(creep, _.get(catalog.getResourceContainers(creep, creep.memory.mineralType, data.containerTypes), '[0].id', false));
	        }else{
	            this.setTrait(creep, _.get(catalog.getEnergyContainers(creep, data.containerTypes), '[0].id', false));
	        }
	        return !!this.target(creep);
	    }

	    process(creep, data, catalog){
	        if(super.process(creep, data, catalog)){
	            return;
	        }
	        var target = this.target(creep);
	        var type = _.get(creep.memory, 'mineralType', RESOURCE_ENERGY);
	        if(target.resourceType && target.resourceType == type){
	            var result = creep.pickup(target);
	            if(result == ERR_NOT_IN_RANGE) {
	                creep.moveTo(target);
	            }
	        }else{
	            var result = creep.withdraw(target, type, Math.min(creep.carryCapacity - _.sum(creep.carry), RoomUtil.getResource(target, type)));
	            if(result == ERR_NOT_IN_RANGE) {
	                creep.moveTo(target);
	            }
	        }
	    }

	    setup(memory, data, catalog, room){
	        if(data.mineral === true){
	            memory.mineralType = RoomUtil.getStat(room, 'mineralType', false);
	            console.log('setup mineral', memory.mineralType);
	        }
	    }
	};

	module.exports = PickupBehavior;

/***/ },
/* 19 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var RoomUtil = __webpack_require__(2);
	var behaviors = __webpack_require__(5);

	class Behavior {

	    static process(catalog){
	        _.forEach(Game.creeps, creep => Behavior.processCreep(creep, catalog));
	    }

	    static idle(creep, targetGameTime){
	        creep.memory.action = 'idle';
	        creep.memory.traits.idle = targetGameTime;
	    }

	    static processCreep(creep, catalog){
	        if(creep.memory.action && !behaviors[creep.memory.action].stillValid(creep, creep.memory.behaviors[creep.memory.action], catalog)){
	            if(!behaviors[creep.memory.action].end){
	                console.log('missing end method', creep.memory.action, creep.name);
	                return;
	            }

	            //DEBUG
	            if(Memory.debugType == creep.memory.type) console.log(creep, 'ending', creep.memory.action);

	            behaviors[creep.memory.action].end(creep, creep.memory.behaviors[creep.memory.action], catalog);
	            catalog.removeTrait(creep, creep.memory.action);
	            creep.memory.action = false;
	        }
	        if(!creep.memory.action){
	            var lowestBid = false;
	            var lowestBidder = false;
	            _.forEach(creep.memory.behaviors, (data, name) =>{
	                if(!behaviors[name] || !behaviors[name].bid){
	                    console.log(name, creep.name, data[name]);
	                    return;
	                }
	                var bid = behaviors[name].bid(creep, data, catalog);
	                if(bid === false){
	                    return;
	                }
	                //DEBUG
	                if(Memory.debugType == creep.memory.type) console.log(creep, bid, name, data, lowestBid, lowestBidder);
	                if(lowestBid === false || bid < lowestBid){
	                    lowestBid = bid;
	                    lowestBidder = name;
	                }
	            });
	            if(lowestBid !== false){
	                var started = behaviors[lowestBidder].start(creep, creep.memory.behaviors[lowestBidder], catalog);
	                //DEBUG
	                if(Memory.debugType == creep.memory.type) console.log(creep, 'starting', lowestBidder, lowestBid, started, creep.memory.traits[lowestBidder]);
	                if(started){
	                    creep.memory.action = lowestBidder;
	                    catalog.addTrait(creep, lowestBidder, creep.memory.traits[lowestBidder]);
	                }else{
	                    //DEBUG
	                    if(Memory.debugType == creep.memory.type) console.log("Failed to start!", creep, lowestBidder);
	                    behaviors[lowestBidder].end(creep, creep.memory.behaviors[lowestBidder], catalog);
	                    catalog.removeTrait(creep, lowestBidder);
	                }
	            }
	        }
	        if(creep.memory.action === 'idle'){
	            if(Game.time >= _.get(creep.memory, 'traits.idle')){
	                creep.memory.action = false;
	                creep.memory.traits.idle = false;
	            }
	        }else if(creep.memory.action){
	            behaviors[creep.memory.action].process(creep, creep.memory.behaviors[creep.memory.action], catalog);
	        }
	    }

	}

	module.exports = Behavior;

/***/ },
/* 20 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var RoomUtil = __webpack_require__(2);

	class Catalog {
	    constructor(){
	        this.traits = {};
	        this.buildings = {};
	        this.hostiles = {};
	        this.hostileStructures = {};
	        this.energy = {};
	        this.creeps = {};
	        this.classCounts = {};
	        this.creepTypes = {};
	        this.deficitCounts = {};
	        this.deficits = {};
	        
	        _.forEach(Game.creeps, creep => {
	            var roomName = creep.pos.roomName;
	            _.forEach(creep.memory.traits, (value, trait) => this.addTrait(creep, trait, value));
	            if(!this.hostiles[roomName]){
	                this.hostiles[roomName] = creep.room.find(FIND_HOSTILE_CREEPS);
	            }
	            if(!this.buildings[roomName]){
	                this.buildings[roomName] = creep.room.find(FIND_STRUCTURES);
	            }
	            if(!this.hostileStructures[roomName]){
	                this.hostileStructures[roomName] = creep.room.find(FIND_HOSTILE_STRUCTURES);
	            }
	            if(this.energy[roomName] === undefined){
	                this.energy[roomName] = this.calculateEnergy(creep);
	            }
	        });

	        this.traitCount = _.mapValues(this.traits, list => _.size(list));
	        this.classCount = _.countBy(Game.creeps, creep => creep.memory.class);
	        this.remoteCreeps = _.filter(Game.creeps, creep => creep.memory.remote);
	        this.remoteClassCount = _.countBy(this.remoteCreeps, creep => creep.memory.class);
	        this.remoteTypeCount = _.countBy(this.remoteCreeps, creep => creep.memory.type);
	        // _.forEach(this.remoteTypeCount, (count, type)=>console.log(type, count));
	    }

	    calculateEnergy(creep){
	        var energy = 0;
	        _.forEach(this.getEnergyContainers(creep), structure => energy += RoomUtil.getEnergy(structure));
	        _.forEach(creep.room.find(FIND_DROPPED_ENERGY), resource => energy += RoomUtil.getEnergy(resource));
	        return energy;
	    }

	    addTrait(creep, trait, value){
	        if(!this.traits[trait]){
	            this.traits[trait] = {};
	        }
	        if(value !== false){
	            this.traits[trait][creep.id] = value;
	        }
	    }

	    removeTrait(creep, trait){
	        if(this.traits[trait] && this.traits[trait][creep.id]){
	            delete this.traits[trait][creep.id];
	        }
	        this.traitCount = _.mapValues(this.traits, list => _.size(list));
	    }

	    getAvailableEnergy(creep){
	        return this.energy[creep.pos.roomName];
	    }

	    getEnergyContainers(creep, containerTypes){
	        var creepEnergyNeed = RoomUtil.getEnergyDeficit(creep);
	        var types = [
	            STRUCTURE_CONTAINER,
	            STRUCTURE_LINK,
	            STRUCTURE_STORAGE
	        ];
	        var containers = _.filter(this.buildings[creep.pos.roomName], structure => _.includes(containerTypes || types, structure.structureType) && RoomUtil.getEnergy(structure) > 0);
	        containers = containers.concat(_.filter(creep.room.find(FIND_DROPPED_ENERGY), container => RoomUtil.getEnergy(container) > 0));
	        return _.sortBy(containers, container => ((1 - Math.min(1, RoomUtil.getEnergy(container)/creepEnergyNeed)) + creep.pos.getRangeTo(container)/50) + Catalog.getEnergyPickupOffset(container));
	    }

	    getEnergyNeeds(creep, { ignoreCreeps, ignoreClass, containerTypes, maxRange, excludeRemote, maxStorage }){
	        var types = [
	            STRUCTURE_CONTAINER,
	            STRUCTURE_EXTENSION,
	            STRUCTURE_TOWER,
	            STRUCTURE_LINK,
	            STRUCTURE_STORAGE,
	            STRUCTURE_SPAWN
	        ];
	        var containers = _.filter(this.buildings[creep.pos.roomName],
	                                  structure => _.includes(containerTypes || types, structure.structureType)
	                                                && RoomUtil.getEnergyPercent(structure) < 1
	                                                && (!maxStorage || RoomUtil.getEnergy(structure) < maxStorage)
	                                 );

	        var filterClass = _.isArray(ignoreClass);
	        if(filterClass || !ignoreCreeps){
	            var targetCreeps = creep.room.find(FIND_MY_CREEPS, {
	                filter: (target)=>!RoomUtil.energyFull(target) && (!filterClass || !_.includes(ignoreClass, target.memory.class))
	            });

	            if(excludeRemote){
	                targetCreeps = _.filter(targetCreeps, creep => !creep.memory.remote);
	            }

	            if(targetCreeps.length > 0){
	                containers = containers.concat(targetCreeps);
	            }
	        }
	        if(maxRange > 0){
	            containers = _.filter(containers, target => creep.pos.getRangeTo(target) <= maxRange);
	        }

	        return _.sortBy(containers, container => RoomUtil.getEnergyPercent(container) + creep.pos.getRangeTo(container)/50 + Catalog.getEnergyDeliveryOffset(container));
	    }

	    getMyBuildings(room){
	        return this.buildings[room.name];
	    }

	    getBuildings(creep, type){
	        if(_.isArray(type)){
	            return _.filter(this.buildings[creep.pos.roomName], structure => _.includes(type, structure.structureType));
	        }
	        if(_.isString(type)){
	            return _.filter(this.buildings[creep.pos.roomName], structure => structure.structureType == type);
	        }
	        return this.buildings[creep.pos.roomName];
	    }

	    getBuildingsByType(room, type){
	        return _.filter(this.buildings[room.name], structure => structure.structureType == type);
	    }

	    getFirstBuilding(room, type){
	        return _.first(_.filter(this.buildings[room.name], structure => structure.structureType == type));
	    }

	    getHostiles(room){
	        return this.getHostileCreeps(room).concat(this.getHostileStructures(room));
	    }

	    getHostileCreeps(room){
	        if(!this.hostiles[room.name]){
	            this.hostiles[room.name] = room.find(FIND_HOSTILE_CREEPS);
	        }
	        return this.hostiles[room.name];
	    }

	    getHostileStructures(room){
	        if(!this.hostileStructures[room.name]){
	            this.hostileStructures[room.name] = room.find(FIND_HOSTILE_STRUCTURES);
	        }
	        return this.hostileStructures[room.name];
	    }

	    getCreeps(room){
	        if(!this.creeps[room.name]){
	            this.creeps[room.name] = room.find(FIND_MY_CREEPS);
	        }
	        return this.creeps[room.name];
	    }

	    getLocalCreeps(room){
	        return _.filter(this.getCreeps(room), creep => !creep.memory.remote);
	    }

	    getClassCount(room){
	        if(!this.classCounts[room.name]){
	            this.classCounts[room.name] = _.countBy(this.getLocalCreeps(room), creep => creep.memory.class);
	        }
	        return this.classCounts[room.name];
	    }

	    getTypeCount(room){
	        if(!this.creepTypes[room.name]){
	            this.creepTypes[room.name] = _.countBy(this.getLocalCreeps(room), creep => creep.memory.type);
	        }
	        return this.creepTypes[room.name];
	    }

	    getResourceContainers(creep, resourceType, containerTypes){
	        var creepCapacity = RoomUtil.getStorageDeficit(creep);
	        var types = [
	            STRUCTURE_CONTAINER,
	            STRUCTURE_STORAGE
	        ];
	        var containers = _.filter(this.buildings[creep.pos.roomName], structure => _.includes(containerTypes || types, structure.structureType) && RoomUtil.getResource(structure, resourceType) > 0);
	        containers = containers.concat(creep.room.find(FIND_DROPPED_RESOURCES, { resourceType }));
	        return _.sortBy(containers, container => (1 - Math.min(1, RoomUtil.getStorage(container)/creepCapacity)) + creep.pos.getRangeTo(container)/50 + Catalog.getResourceDeliveryOffset(container));
	    }

	    
	    
	    static getEnergyPickupPriority(target){
	        if(!target.structureType){
	            return 1;
	        }
	        var priorities = {
	            'container': 1,
	            'storage': 2,
	            'link': 1
	        };
	        return _.get(priorities, target.structureType, 1);
	    }
	    
	    static getEnergyDeliveryPriority(target){
	        if(!target.structureType){
	            return 1;
	        }
	        var priorities = {
	            'spawn': 0.25,
	            'extension': 0.25,
	            'tower': 0.5,
	            'container': 1,
	            'storage': 2,
	            'link': 20
	        };
	        return _.get(priorities, target.structureType, 1);
	    }
	    
	    static getEnergyDeliveryOffset(target){
	        if(!target.structureType){
	            return 0;
	        }
	        var priorities = {
	            'spawn': -0.125,
	            'extension': -0.125,
	            'tower': 0,
	            'container': 0.125,
	            'storage': 0.5,
	            'link': 0.125
	        };
	        return _.get(priorities, target.structureType, 0);
	    }
	    
	    static getEnergyPickupOffset(target){
	        if(!target.structureType){
	            return 0;
	        }
	        var priorities = {
	            'container': 0.125,
	            'storage': 0.125,
	            'link': 0
	        };
	        return _.get(priorities, target.structureType, 0);
	    }

	    static getResourceDeliveryOffset(target){
	        if(!target.structureType){
	            return 0;
	        }
	        var priorities = {
	            'container': 0.125,
	            'storage': 0,
	            'terminal': -0.5
	        };
	        return _.get(priorities, target.structureType, 0);
	    }
	}

	module.exports = Catalog;

/***/ }
/******/ ]);