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
	var Behavior = __webpack_require__(4);
	var Catalog = __webpack_require__(17);

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
	                buildJobs: buildSites.length,
	                extractor: catalog.getBuildingsByType(spawn.room, STRUCTURE_EXTRACTOR).length > 0
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

/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var RoomUtil = __webpack_require__(2);

	class Controller {

	    static control(catalog){
	        var towers = _.filter(Game.structures, {structureType: STRUCTURE_TOWER});
	        towers.forEach(tower => {
	            if(!Controller.towerDefend(tower, catalog) && tower.energy > tower.energyCapacity * 0.75){
	                if(!Controller.towerHeal(tower, catalog)){
	                    Controller.towerRepair(tower, catalog)
	                }
	            }
	        });

	        _.forEach(Memory.linkTransfer, (target, source) => Controller.linkTransfer(Game.getObjectById(source), Game.getObjectById(target)));
	    }

	    static towerDefend(tower, catalog) {
	        var hostiles = catalog.getHostileCreeps(tower.room);
	        if(hostiles.length > 0) {
	            var enemies = _.sortBy(hostiles, (target)=>tower.pos.getRangeTo(target));
	            console.log("Attacking...", enemies[0]);
	            return tower.attack(enemies[0]) == OK;
	        }
	        return false;
	    }

	    static towerHeal(tower, catalog) {
	        var injuredCreeps = _.filter(catalog.getCreeps(tower.room), creep => creep.hits < creep.hitsMax);
	        if(injuredCreeps.length > 0) {
	            var injuries = _.sortBy(injuredCreeps, creep => creep.hits / creep.hitsMax);
	            console.log("Healing...", injuries[0]);
	            return tower.heal(injuries[0]) == OK;
	        }
	        return false;
	    }

	    static towerRepair(tower, catalog) {
	        var damagedBuildings = _.filter(catalog.buildings[tower.room.name], structure => structure.hits < structure.hitsMax && structure.hits < Memory.settings.towerRepairThreshold);
	        if(damagedBuildings.length > 0) {
	            var damaged = _.sortBy(damagedBuildings, structure => structure.hits / structure.hitsMax);
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
	            filter: (creep)=>!!creep.memory.traits.mining
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

	    static getEnergy(entity){
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

	var classConfig = __webpack_require__(19);

	class Spawner {

	    static mourn(){
	        for(var name in Memory.creeps) {
	            if(!Game.creeps[name]) {
	                delete Memory.creeps[name];
	            }
	        }
	    }

	    static canSpawn(spawn, loadout){
	        return !spawn.spawning && spawn.canCreateCreep(loadout) == OK;
	    }

	    static shouldSpawn(spawn, fullType, className, version, catalog, category, roomStats){
	        if(!Spawner.checkRequirements(spawn, catalog, category, version, roomStats)){
	            return false;
	        }
	        if(version.remote || category.remote){
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
	            if(requirements.disableAt > 0 && roomStats.spawn >= requirements.disableAt){
	                return false;
	            }
	            if(requirements.extractor && !roomStats.extractor){
	                return false;
	            }
	            if(requirements.flag && !Game.flags[requirements.flag]){
	                return false;
	            }
	            if(requirements.repairHits > 0 && requirements.repairHits > roomStats.repairHits){
	                return false;
	            }
	        }
	        return true;
	    }

	    static findCriticalDeficit(spawn, catalog){
	        var roomStats = Memory.stats.rooms[spawn.room.name];
	        var typeCount = catalog.getTypeCount(spawn.room);
	        var deficits = {};
	        var deficitCount = {};
	        var deficit = 0;
	        _.forEach(classConfig, (config, className) => {
	            _.forEach(config.versions, (version, typeName) =>{
	                if(version.critical > 0 && version.critical <= roomStats.spawn && Spawner.checkRequirements(spawn, catalog, config, version, roomStats)){
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

	    static prepareSpawnMemory(category, version, fullType, className, versionName){
	        return {
	            class: className,
	            type: fullType,
	            version: versionName,
	            behaviors: version.behaviors || category.behaviors,
	            traits: {},
	            action: false,
	            remote: version.remote || category.remote
	        }
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
	                if(!startedSpawn && Spawner.canSpawn(spawn, version.loadout) && Spawner.shouldSpawn(spawn, fullType, className, version, catalog, category, roomStats)){
	                    var spawned = spawn.createCreep(version.loadout, fullType+'-'+Memory.uid, Spawner.prepareSpawnMemory(category, version, fullType, className, prefix));
	                    startedSpawn = !!spawned;
	                    Memory.uid++;
	                    console.log(spawn.name, 'spawning', fullType, 'new count:', Spawner.getCount(spawn, catalog, category, version, fullType)+1, spawned);
	                    //HACK reset deficit count until next tick, so we don't accidentally interrupt any jobs
	                    catalog.deficits[spawn.room.name] = 0;
	                    catalog.deficitCounts[spawn.room.name] = {};
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
	            Spawner.resetBehavior();
	        }
	        var spawned = false;
	        _.forEach(Game.spawns, spawn => {
	            spawned = Spawner.processSpawn(spawn, catalog, spawned);
	        });
	    }

	    static resetBehavior(){
	        _.forEach(Game.creeps, creep=>{
	            var config = _.get(classConfig, creep.memory.class, false);
	            var version = _.get(config, ['versions', creep.memory.version || creep.memory.type.replace(creep.memory.class, '')], false);
	            if(!config || !version){
	                return;
	            }
	            creep.memory.behaviors = version.behaviors || config.behaviors;
	            creep.memory.traits = {};
	            creep.memory.action = false;
	        });
	        Memory.resetBehavior = false;
	        console.log("Reset behavior!");
	    }
	}


	module.exports = Spawner;

/***/ },
/* 4 */
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
	var Extract = __webpack_require__(18);
	var Mining = __webpack_require__(13);
	var Repair = __webpack_require__(14);
	var Upgrade = __webpack_require__(15);
	var Pickup = __webpack_require__(16);

	module.exports = {
	    attack: new Attack(),
	    defend: new NOP(),
	    build: new Build(),
	    emergencydeliver: new EmergencyDeliver(),
	    extract: new Extract(),
	    deliver: new Deliver(),
	    drop: new Drop(),
	    mining: new Mining(),
	    repair: new Repair(),
	    upgrade: new Upgrade(),
	    claim: new ClaimBehavior(),
	    reserve: new ReserveBehavior(),
	    pickup: new Pickup()
	}

/***/ },
/* 6 */
/***/ function(module, exports) {

	"use strict";

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
	}

	class RemoteBaseBehavior extends BaseBehavior {
	    constructor(type){ super(type); }

	    stillValid(creep, data, catalog){
	        var flag = Game.flags[data.flag];
	        if(flag && (creep.pos.roomName != flag.pos.roomName || RoomUtil.onEdge(creep.pos))){
	            return true;
	        }
	        return false;
	    }
	    bid(creep, data, catalog){
	        var flag = Game.flags[data.flag];
	        return flag && creep.pos.roomName != flag.pos.roomName;
	    }
	    start(creep, data, catalog){
	        var flag = Game.flags[data.flag];
	        return flag && creep.pos.roomName != flag.pos.roomName;
	    }
	    process(creep, data, catalog){
	        var flag = Game.flags[data.flag];
	        if(flag && (creep.pos.roomName != flag.pos.roomName || RoomUtil.onEdge(creep.pos))){
	            creep.moveTo(flag);
	            return true;
	        }
	        return false;
	    }
	}

	class BaseFlagBehavior {

	    stillValid(creep, data, catalog){
	        return !!Game.flags[data.flag];
	    }

	    bid(creep, data, catalog){
	        return !!Game.flags[data.flag];
	    }

	    start(creep, data, catalog){
	        return !!Game.flags[data.flag];
	    }

	    process(creep, data, catalog){ }

	    end(creep, data, catalog){ }
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
	        var hostiles = catalog.hostiles[creep.pos.roomName];
	        var hostileStructures = catalog.hostileStructures[creep.pos.roomName];
	        
	        var targetFlag = Game.flags[_.get(Memory, 'targetFlag', _.get(data, 'flag', 'Base'))];
	        if(!targetFlag){
	            targetFlag = Game.flags['Base'];
	        }
	        // console.log(targetFlag, _.get(Memory, 'targetFlag', _.get(data, 'flag', 'Base')));
	        var manualTarget = _.get(Memory, 'manualTarget', false);
	        var target = false;
	        if(targetFlag && (creep.pos.roomName != targetFlag.pos.roomName || (hostiles.length < 1 && hostileStructures.length < 1 && !manualTarget))){
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
	        }else if(hostileStructures.length > 0){
	            var enemies = _.sortBy(hostileStructures, (target)=>creep.pos.getRangeTo(target));
	            target = enemies[0];
	        }
	        if(target){
	            var result = creep.attack(target);
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
	            return RoomUtil.getStoragePercent(target) < 0.85;
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

	class MiningBehavior extends RemoteBaseBehavior {
	    constructor(){ super('mining'); }

	    stillValid(creep, data, catalog){
	        if(super.stillValid(creep, data, catalog)){
	            return true;
	        }
	        var target = Game.getObjectById(creep.memory.traits.mining);
	        if(target && data.maxRange && data.maxRange < creep.pos.getRangeTo(target)){
	            return false;
	        }
	        return creep.carry.energy < creep.carryCapacity - 10 && target;
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
	            creep.memory.traits.mining = creep.memory.lastSource;
	        }else{
	            creep.memory.traits.mining = RoomUtil.findFreeMiningId(creep.room, creep, catalog);
	        }
	        
	        return RoomUtil.exists(creep.memory.traits.mining);
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
/* 14 */
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
	        return creep.carry.energy > 0 && target && target.pos.roomName == creep.pos.roomName && target.hits < target.hitsMax && target.hits < Memory.repairTarget;
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
/* 15 */
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
/* 16 */
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
	        return target && target.pos.roomName == creep.pos.roomName && RoomUtil.getEnergy(target) > 0 && RoomUtil.getEnergyPercent(creep) < 0.9;
	    }

	    bid(creep, data, catalog){
	        var energy = RoomUtil.getEnergyPercent(creep);
	        if(energy < 0.2 && super.bid(creep, data, catalog)){
	            return energy;
	        }
	        if(energy > 0.75 || catalog.getAvailableEnergy(creep) < 1){
	            return false;
	        }
	        return energy * 2;
	    }

	    start(creep, data, catalog){
	        if(super.start(creep, data, catalog)){
	            return true;
	        }
	        this.setTrait(creep, _.get(catalog.getEnergyContainers(creep, data.containerTypes), '[0].id', false));
	        return !!this.target(creep);
	    }

	    process(creep, data, catalog){
	        if(super.process(creep, data, catalog)){
	            return;
	        }
	        var target = this.target(creep);
	        if(target.resourceType && target.resourceType == RESOURCE_ENERGY){
	            var result = creep.pickup(target);
	            if(result == ERR_NOT_IN_RANGE) {
	                creep.moveTo(target);
	            }
	        }else{
	            var result = creep.withdraw(target, RESOURCE_ENERGY, Math.min(creep.carryCapacity - creep.carry.energy, RoomUtil.getEnergy(target)));
	            if(result == ERR_NOT_IN_RANGE) {
	                creep.moveTo(target);
	            }
	        }
	    }
	};

	module.exports = PickupBehavior;

/***/ },
/* 17 */
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
	        containers = containers.concat(creep.room.find(FIND_DROPPED_ENERGY));
	        return _.sortBy(containers, container => ((1 - Math.min(1, RoomUtil.getEnergy(container)/creepEnergyNeed)) + creep.pos.getRangeTo(container)/50) * Catalog.getEnergyPickupPriority(container));
	    }

	    getEnergyNeeds(creep, { ignoreCreeps, ignoreClass, containerTypes, maxRange, excludeRemote }){
	        var types = [
	            STRUCTURE_CONTAINER,
	            STRUCTURE_EXTENSION,
	            STRUCTURE_TOWER,
	            STRUCTURE_LINK,
	            STRUCTURE_STORAGE,
	            STRUCTURE_SPAWN
	        ];
	        var containers = _.filter(this.buildings[creep.pos.roomName], structure => _.includes(containerTypes || types, structure.structureType) && RoomUtil.getEnergyPercent(structure) < 1);

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

	        return _.sortBy(containers, container => (RoomUtil.getEnergyPercent(container) + creep.pos.getRangeTo(container)/50) * Catalog.getEnergyDeliveryPriority(container));
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

	    getHostiles(room){
	        return this.hostiles[room.name].concat(this.hostileStructures[room.name]);
	    }

	    getHostileCreeps(room){
	        return this.hostiles[room.name];
	    }

	    getHostileStructures(room){
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

	    
	    
	    static getEnergyPickupPriority(target){
	        if(target.amount > 0){
	            return Math.max(0, 1 - target.amount / 200);
	        }
	        if(!target.structureType){
	            return 1;
	        }
	        var priorities = {
	            'container': 1,
	            'storage': 100,
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
	            'container': 1.5,
	            'storage': 5,
	            'link': 20
	        };
	        return _.get(priorities, target.structureType, 1);
	    }
	}

	module.exports = Catalog;

/***/ },
/* 18 */
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
/* 19 */
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
	                loadout: partList({work: 6, carry: 2, move: 4})
	            },
	            nano: {
	                ideal: 2,
	                critical: 750,
	                requirements: {
	                    disableAt: 900
	                },
	                additional: {
	                    unless: 1,
	                    spawn: 900
	                },
	                loadout: partList({work: 6, carry: 2, move: 1})
	            },
	            pano: {
	                bootstrap: 1,
	                critical: 500,
	                requirements: {
	                    disableAt: 750
	                },
	                additional: {
	                    unless: 3,
	                    spawn: 750
	                },
	                loadout: partList({work: 4, carry: 1, move: 1})
	            },
	            pico: {
	                bootstrap: 1,
	                loadout: partList({work: 2, carry: 1, move: 1}),
	                additional: {
	                    unless: 1,
	                    spawn: 500
	                }
	            },
	            remote: {
	                ideal: 2,
	                loadout: partList({work: 6, carry: 2, move: 2}),
	                requirements: {
	                    flag: 'Harvest'
	                },
	                behaviors: {
	                    mining: { flag: 'Harvest' },
	                    deliver: { maxRange: 1, ignoreClass: ['miner', 'extractor'], excludeRemote: true },
	                    drop: { priority: 0.75 }
	                },
	                remote: true
	            }
	        },
	        behaviors: {
	            mining: {},
	            deliver: { maxRange: 1, ignoreClass: ['miner', 'extractor'] },
	            drop: { priority: 10 }
	        }
	    },
	    hauler: {
	        versions: {
	            spawn: {
	                ideal: 2,
	                critical: 400,
	                loadout: partList({carry: 4, move: 4}),
	                behaviors: {
	                    pickup: { containerTypes: [ STRUCTURE_CONTAINER, STRUCTURE_STORAGE ] },
	                    deliver: { containerTypes: [ STRUCTURE_EXTENSION, STRUCTURE_SPAWN ], ignoreCreeps: true }
	                }
	            },
	            nano: {
	                ideal: 2,
	                loadout: partList({carry: 5, move: 5})
	            },
	            pico: {
	                bootstrap: 2,
	                loadout: partList({carry: 2, move: 4})
	            },
	            remote: {
	                ideal: 1,
	                loadout: partList({carry: 6, move: 6}),
	                remote: true,
	                requirements: {
	                    flag: 'Collect'
	                },
	                behaviors: {
	                    pickup: { flag: 'Collect', containerTypes: [ STRUCTURE_CONTAINER ]  },
	                    deliver: { flag: 'Base', ignoreCreeps: true }
	                },
	            }
	        },
	        behaviors: {
	            pickup: { containerTypes: [ STRUCTURE_CONTAINER, STRUCTURE_STORAGE ] },
	            deliver: {
	                ignoreClass: [ 'hauler', 'miner', 'extractor' ],
	                containerTypes: [ STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_SPAWN ],
	                excludeRemote: true
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
	                loadout: partList({work: 4, carry: 2, move: 6})
	            },
	            nano: {
	                ideal: 2,
	                requirements: {
	                    disableAt: 800
	                },
	                additional: {
	                    count: 1,
	                    buildHits: 1000
	                },
	                loadout: partList({work: 2, carry: 2, move: 4})
	            },
	            pico: {
	                bootstrap: 1,
	                additional: {
	                    count: 1,
	                    buildHits: 1000
	                },
	                loadout: partList({work: 1, carry: 2, move: 2})
	            },
	            repair: {
	                ideal: 1,
	                requirements: {
	                    repairHits: 5000 
	                },
	                additional: {
	                    count: 1,
	                    repairHits: 10000
	                },
	                loadout: partList({work: 4, carry: 2, move: 4}),
	                behaviors: { pickup: {}, repair: {}, emergencydeliver: {} }
	            },
	            picorepair: {
	                ideal: 1,
	                requirements: {
	                    disableAt: 700
	                },
	                additional: {
	                    count: 1,
	                    repairHits: 10000
	                },
	                loadout: partList({work: 2, carry: 2, move: 4}),
	                behaviors: { pickup: {}, repair: {}, emergencydeliver: {} }
	            },
	            upgrade: {
	                ideal: 3,
	                loadout: partList({work: 6, carry: 2, move: 3}),
	                behaviors: { pickup: {}, upgrade: {}, emergencydeliver: {} }
	            },
	            remoteupgrade: {
	                ideal: 2,
	                requirements: {
	                    flag: 'Upgrade'
	                },
	                loadout: partList({work: 6, carry: 4, move: 3}),
	                behaviors: { pickup: {}, upgrade: { flag: 'Upgrade' }, emergencydeliver: {} },
	                remote: true
	            },
	            remoterepair: {
	                ideal: 1,
	                requirements: {
	                    flag: 'Repair'
	                },
	                loadout: partList({work: 2, carry: 2, move: 4}),
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
	                    extractor: true
	                },
	                loadout: partList({work: 10, carry: 2, move: 6})
	            }
	        },
	        behaviors: {
	            extract: {},
	            deliver: { maxRange: 50, ignoreCreeps: true, containerTypes: [ STRUCTURE_CONTAINER, STRUCTURE_STORAGE ] },
	            drop: { priority: 10 }
	        }
	    },
	    fighter: {
	        versions: {
	            pico: {
	                ideal: 0,
	                loadout: partList({tough: 8, move: 8, attack: 8}),
	                remote: true
	            }
	        },
	        behaviors: { attack: { flag: 'Attack' }, defend: { flag: 'Base' } }
	    },
	    claimer: {
	        versions: {
	            pico: {
	                ideal: 2,
	                requirements: {
	                    flag: 'Reserve'
	                },
	                loadout: [ CLAIM, MOVE ],
	                remote: true
	            }
	        },
	        behaviors: { claim: { flag: 'Claim' }, reserve: { flag: 'Reserve' } }
	    }
	};

/***/ }
/******/ ]);