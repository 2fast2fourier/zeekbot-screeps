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
	var Spawner = __webpack_require__(2);
	var WorkManager = __webpack_require__(4);
	var Catalog = __webpack_require__(30);
	var Misc = __webpack_require__(50);
	var Production = __webpack_require__(51);

	module.exports.loop = function () {
	    PathFinder.use(true);
	    Misc.initMemory();
	    if(!Memory.settings){
	        Misc.setSettings();
	    }

	    Misc.mourn();

	    var catalog = new Catalog();
	    var production = new Production(catalog);

	    if(Memory.refreshTransfer){
	        _.forEach(catalog.buildings.lab, lab => {
	            Memory.transfer.lab[lab.id] = false;
	            Memory.transfer.energy[lab.id] = lab.energyCapacity;
	        });
	        _.forEach(catalog.buildings.terminal, terminal => {
	            Memory.transfer.energy[terminal.id] = 50000;
	        });
	        console.log('refreshed transfer settings');
	        Memory.refreshTransfer = false;
	    }

	    if(Memory.updateTime < Game.time || !Memory.updateTime || !Memory.stats){
	        Misc.updateStats(catalog);
	        Memory.updateTime = Game.time + Memory.settings.updateDelta;
	    }

	    var startup = Game.cpu.getUsed();
	    catalog.profile('startup', startup);

	    production.process();

	    catalog.jobs.generate();
	    catalog.jobs.allocate();
	    catalog.quota.process();

	    // console.log(_.size(catalog.jobs.jobs.keep), catalog.jobs.capacity.keep);
	    // _.forEach(catalog.jobs.jobs.transfer, (job, id) => console.log(id, job.target, job.pickup, job.amount, job.resource));

	    var jobs = Game.cpu.getUsed();
	    catalog.profile('jobs', jobs - startup);
	    
	    WorkManager.process(catalog);

	    var worker = Game.cpu.getUsed();
	    catalog.profile('worker', worker - jobs);

	    Spawner.spawn(catalog);

	    var spawner = Game.cpu.getUsed();
	    Controller.control(catalog);
	    catalog.profile('controller', Game.cpu.getUsed() - spawner);

	    var usage = Game.cpu.getUsed();
	    var profile = Memory.stats.profile;
	    profile.avg = (profile.avg*profile.count + usage)/(profile.count+1);
	    profile.count++;
	    if(profile.max < usage){
	        profile.max = usage;
	    }
	    if(profile.min > usage){
	        profile.min = usage;
	    }

	    catalog.finishProfile();
	}

/***/ },
/* 1 */
/***/ function(module, exports) {

	"use strict";

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

	        _.forEach(Memory.linkTransfer, (target, source) => Controller.linkTransfer(source, target, catalog));
	        _.forEach(Memory.react, (data, type) => Controller.runReaction(type, data, catalog));
	    }

	    static towerDefend(tower, catalog) {
	        var hostiles = catalog.getHostileCreeps(tower.room);
	        var healer = _.find(hostiles, creep => creep.getActiveBodyparts(HEAL) > 0);
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
	        var damagedBuildings = _.filter(catalog.getStructures(tower.room), structure => structure.hits < Math.min(structure.hitsMax, Memory.settings.repairTarget) * Memory.settings.towerRepairPercent);
	        if(damagedBuildings.length > ix) {
	            var damaged = _.sortBy(damagedBuildings, structure => structure.hits / Math.min(structure.hitsMax, Memory.settings.repairTarget));
	            tower.repair(damaged[ix]);
	        }
	    }

	    static linkTransfer(sourceId, targetId, catalog){
	        var minimumNeed = 50;
	        var source = Game.getObjectById(sourceId);
	        var target;
	        if(_.isObject(targetId)){
	            target = Game.getObjectById(targetId.target);
	            minimumNeed = targetId.minimumNeed || 50;
	        }else{
	            target = Game.getObjectById(targetId);
	        }
	        if(!source || !target){
	            console.log('invalid linkTransfer', source, target);
	            return false;
	        }
	        var need = catalog.getAvailableCapacity(target);
	        var sourceEnergy = catalog.getResource(source, RESOURCE_ENERGY);
	        if(source && need >= minimumNeed && source.cooldown == 0 && need > 0 && sourceEnergy > 0){
	            source.transferEnergy(target, Math.min(sourceEnergy, need));
	        }
	    }

	    static runReaction(type, data, catalog){
	        var labs = _.map(Memory.production.labs[data.lab], labId => Game.getObjectById(labId));
	        var targetLab = labs[2];
	        if(!_.every(labs) || !targetLab){
	            console.log('missing labs for reaction', labs, type, data.lab);
	            return;
	        }
	        if(targetLab.mineralType == type){
	            Memory.transfer.lab[targetLab.id] = 'store';
	        }else if(targetLab.mineralType){
	            Memory.transfer.lab[targetLab.id] = false;
	            return;
	        }
	        if(targetLab.cooldown > 0 || targetLab.mineralAmount == targetLab.mineralCapacity){
	            return;
	        }
	        if(labs[0].mineralType != data.components[0] || labs[1].mineralType != data.components[1]){
	            return;
	        }
	        if(labs[0].mineralAmount == 0 || labs[1].mineralAmount == 0){
	            return;
	        }
	        targetLab.runReaction(labs[0], labs[1]);
	    }
	}

	module.exports = Controller;

/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var classConfig = __webpack_require__(3);

	class Spawner {

	    static spawn(catalog){
	        var start = Game.cpu.getUsed();
	        if(Memory.resetBehavior){
	            Spawner.resetBehavior(catalog);
	        }
	        // var spawnlist = Spawner.generateSpawnList(catalog);
	        var spawned = false;
	        _.forEach(Game.spawns, spawn => {
	            spawned = Spawner.processSpawn(spawn, catalog, spawned);
	        });
	        catalog.profile('spawner', Game.cpu.getUsed() - start);
	    }

	    static generateSpawnList(catalog){
	        var spawnlist = {
	            spawn: {},
	            critical: {},
	            costs: {}
	        };
	        var allocation = Spawner.calculateQuotaAllocation(catalog);
	        // _.forEach(allocation, (allocated, type) => console.log(type, allocated));
	        
	        _.forEach(classConfig, (config, className)=>{
	            _.forEach(config.versions, (version, versionName)=>{
	                var type = versionName+className;
	                var limit = Spawner.calculateSpawnLimit(catalog, type, version, config);
	                var quota = Spawner.calculateRemainingQuota(catalog, type, version, config, allocation);
	                if(Math.min(limit, quota) > 0){
	                    spawnlist.costs[type] = Spawner.calculateCost(version.parts || config.parts);
	                    if(version.critical){
	                        spawnlist.critical[type] = Math.min(limit, quota);
	                        // console.log('critical spawn', type, limit, quota, spawnlist.costs[type]);
	                    }else{
	                        // console.log('spawn', type, limit, quota, spawnlist.costs[type]);
	                    }
	                    spawnlist.spawn[type] = Math.min(limit, quota);
	                }
	            });
	        });
	        // _.forEach(spawnlist.costs, (cost, type) => console.log(type, cost));

	        return spawnlist;
	    }

	    static calculateQuotaAllocation(catalog){
	        var allocation = {};
	        _.forEach(classConfig, (config, className)=>{
	            _.forEach(config.versions, (version, versionName)=>{
	                var type = versionName+className;
	                var quota = version.quota || config.quota;
	                if(quota){
	                    var jobType = _.isString(quota) ? quota : quota.jobType;
	                    var allocate = _.get(version, 'allocation', _.get(quota, 'allocation', 1));
	                    _.set(allocation, jobType, _.get(allocation, jobType, 0) + (_.get(catalog.creeps.type, [type, 'length'], 0) * allocate));
	                }

	            });
	        });

	        return allocation;
	    }

	    static calculateRemainingQuota(catalog, type, version, config, allocation){
	        var quota = version.quota || config.quota;
	        if(quota){
	            var jobType = _.isString(quota) ? quota : quota.jobType;
	            var capacity = _.get(catalog.jobs.capacity, jobType, 0);
	            var creepsNeeded = Math.ceil(capacity/_.get(version, 'allocation', _.get(quota, 'allocation', 1)));
	            var existing = Math.ceil(_.get(allocation, jobType, 0)/_.get(version, 'allocation', _.get(quota, 'allocation', 1)));
	            // if(type == 'milliminer'){
	            //     console.log(jobType, capacity, _.get(allocation, jobType, 0));
	            // }
	            return Math.min(creepsNeeded, _.get(quota, 'max', Infinity)) - existing;
	        }
	        return 0;
	    }

	    static calculateScalingQuota(catalog, type, version, config, allocation){
	        var quota = _.get(version, 'ideal', 0);
	        var scale = version.scale || config.scale;
	        if(scale){
	            //TODO make generic stats collection to remove this if-chain
	            if(scale.room > 0){
	                quota += Math.ceil(scale.room * catalog.rooms.length);
	            }
	            if(scale.repair > 0){
	                quota += Math.ceil(Memory.stats.global.repair / scale.repair);
	            }
	            if(scale.energy > 0){
	                quota += Math.floor(Memory.stats.global.totalEnergy / scale.energy);
	            }
	        }
	        return Math.min(quota, _.get(scale, 'max', Infinity));
	    }

	    static calculateSpawnLimit(catalog, type, version, config){
	        if(version.disable){
	            if(version.disable.maxSpawn > 0 && Memory.stats.global.maxSpawn >= version.disable.maxSpawn){
	                return 0;
	            }
	        }
	        return Infinity;
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







	// nuke this sick code

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

	        var additionalPer = version.additionalPer || config.additionalPer;
	        if(additionalPer){
	            var add = 0;
	            if(additionalPer.flagPrefix){
	                add += catalog.getFlagsByPrefix(additionalPer.flagPrefix).length * _.get(additionalPer, 'count', 1);
	            }
	            if(additionalPer.room > 0){
	                add += catalog.rooms.length * additionalPer.room;
	            }
	            if(additionalPer.repair > 0){
	                add += Math.ceil(Memory.stats.global.repair / additionalPer.repair);
	            }
	            if(additionalPer.max > 0){
	                count += Math.min(add, additionalPer.max);
	            }else{
	                count += add;
	            }
	        }

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
	                return false;
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
	            rules: version.rules || category.rules,
	            actions: version.actions || category.actions
	        };

	        var optMemory = version.memory || category.memory;
	        if(optMemory){
	            _.assign(memory, optMemory);
	        }

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

	    static resetBehavior(catalog){
	        var classConvert = {
	            keepminer: 'miner',
	            keepfighter: 'fighter',
	            tender: 'hauler'
	        }
	        var classFallback = {
	            miner: 'milli',
	            hauler: 'micro',
	            worker: 'repair',
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
	            creep.memory.actions = version.actions || config.actions;
	            creep.memory.jobId = false;
	            creep.memory.jobType = false;
	            creep.memory.jobAllocation = 0;
	            var optMemory = version.memory || config.memory;
	            if(optMemory){
	                _.assign(creep.memory, optMemory);
	            }
	        });
	        Memory.resetBehavior = false;
	        console.log("Reset behavior!");
	    }
	}


	module.exports = Spawner;

/***/ },
/* 3 */
/***/ function(module, exports) {

	"use strict";

	module.exports = {
	    miner: {
	        versions: {
	            // boost: {
	            //     allocation: 7,
	            //     critical: 500,
	            //     parts: { move: 4, carry: 2, work: 2},
	            //     boost: { XUHO2: 2 }
	            // },
	            milli: {
	                allocation: 7,
	                critical: 1400,
	                parts: { move: 5, carry: 2, work: 8 }
	            },
	            // micro: {
	            //     allocation: 6,
	            //     critical: 750,
	            //     disable: {
	            //         maxSpawn: 1400
	            //     },
	            //     parts: {work: 6, carry: 2, move: 1}
	            // },
	            // nano: {
	            //     allocation: 4,
	            //     critical: 550,
	            //     disable: {
	            //         maxSpawn: 750
	            //     },
	            //     parts: {work: 4, carry: 2, move: 1}
	            // },
	            // pico: {
	            //     bootstrap: 1,
	            //     quota: false,
	            //     critical: 300,
	            //     parts: {work: 2, carry: 1, move: 1},
	            //     disable: {
	            //         energy: 2000
	            //     }
	            // }
	        },
	        quota: {
	            jobType: 'mine',
	            ratio: 1
	        },
	        rules: {
	            mine: {},
	            // deliver: { maxRange: 2, ignoreCreeps: true, types: [ STRUCTURE_STORAGE, STRUCTURE_CONTAINER, STRUCTURE_TOWER ] },
	            drop: { priority: 5 }
	        },
	        actions: { avoid: {}, minecart: {} }
	    },
	    hauler: {
	        versions: {
	            spawn: {
	                critical: 600,
	                parts: {carry: 10, move: 10},
	                additionalPer: {
	                    room: 2
	                },
	                rules: {
	                    pickup: { subtype: false },
	                    deliver: { subtype: 'spawn' },
	                    idle: { type: 'spawn' }
	                }
	            },
	            // picospawn: {
	            //     bootstrap: 1,
	            //     critical: 300,
	            //     parts: {carry: 3, move: 3},
	            //     rules: {
	            //         pickup: {},
	            //         deliver: { types: [ STRUCTURE_SPAWN, STRUCTURE_EXTENSION ], ignoreCreeps: true, subtype: 'spawn' },
	            //         idle: { type: 'spawn' }
	            //     }
	            // },
	            transfer: {
	                quota: {
	                    jobType: 'transfer',
	                    allocation: 500,
	                    max: 2
	                },
	                rules: { transfer: {}, deliver: { minerals: true, mineralTypes: [ STRUCTURE_STORAGE ], priority: 99 } },
	                parts: {carry: 10, move: 10}
	            },
	            leveler: {
	                additionalPer: {
	                    room: 2
	                },
	                rules: {
	                    pickup: { types: [ STRUCTURE_STORAGE ], distanceWeight: 150, min: 250000 },
	                    deliver: { types: [ STRUCTURE_STORAGE ], ignoreCreeps: true, ignoreDistance: true }
	                },
	                parts: { carry: 20, move: 10 }
	            },
	            long: {
	                // ideal: 2,
	                // additionalPer: {
	                //     count: 4,
	                //     flagPrefix: 'Pickup'
	                // },
	                // quota: {
	                //     jobType: 'mine',
	                //     allocation: 6
	                // },
	                ideal: 20,
	                rules: {
	                    pickup: { minerals: true, types: [ STRUCTURE_CONTAINER ], distanceWeight: 150, subtype: 'remote' },
	                    deliver: { types: [ STRUCTURE_STORAGE ], ignoreCreeps: true, distanceWeight: 100, profile: true }
	                },
	                parts: { carry: 20, move: 10 }
	            },
	            mineral: {
	                ideal: 1,
	                parts: { carry: 6, move: 6 },
	                rules: {
	                    pickup: { subtype: 'mineral', minerals: true, types: [ STRUCTURE_CONTAINER ] },
	                    deliver: {}
	                }
	            },
	            // nano: {
	            //     ideal: 2,
	            //     disable: {
	            //         maxSpawn: 600
	            //     },
	            //     parts: { carry: 5, move: 5 }
	            // },
	            // pico: {
	            //     bootstrap: 1,
	            //     parts: { carry: 2, move: 2 }
	            // }
	        },
	        actions: { avoid: {} }
	    },
	    observer: {
	        versions: {
	            soaker: {
	                additionalPer: {
	                    count: 5,
	                    flagPrefix: 'Observe-soak'
	                },
	                parts: { tough: 40, move: 10 },
	                memory: { ignoreHealth: true },
	                rules: { observe: { subtype: 'soak' } }
	            },
	            pico: {
	                additionalPer: {
	                    count: 1,
	                    flagPrefix: 'Observe'
	                },
	                parts: {tough: 1, move: 1},
	                memory: { ignoreHealth: true },
	                rules: { observe: { subtype: false } }
	            }
	        }
	    },
	    worker: {
	        versions: {
	            builder: {
	                quota: {
	                    jobType: 'build',
	                    allocation: 3,
	                    max: 4
	                },
	                rules: {
	                    pickup: {},
	                    build: {},
	                    repair: { priority: 99 }
	                },
	                parts: { work: 4, carry: 4, move: 8 }
	            },
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
	                additionalPer: {
	                    repair: 10000,
	                    max: 10
	                },
	                rules: { pickup: {}, repair: {} },
	                actions: { avoid: {}, repair: {} },
	                parts: { work: 5, carry: 5, move: 10 }
	            }
	        },
	        rules: {
	            pickup: {},
	            build: {},
	            repair: { priority: 5 },
	            upgrade: { priority: 10 },
	            idle: { type: 'worker' }
	        },
	        actions: { avoid: {} }
	    },
	    claimer: {
	        versions: {
	            attack: {
	                parts: { claim: 5, move: 5 },
	                additionalPer: {
	                    count: 2,
	                    flagPrefix: 'Reserve-downgrade'
	                },
	                rules: { reserve: { downgrade: true } }
	            },
	            pico: {
	                parts: { claim: 2, move: 2 },
	                additionalPer: {
	                    count: 1,
	                    flagPrefix: 'Reserve'
	                }
	                // quota: {
	                //     jobType: 'reserve',
	                //     allocation: 2,
	                //     ratio: 1
	                // }
	            }
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
	            max: 1
	        },
	        rules: { heal: {}, idle: { type: 'heal' } }
	    },
	    fighter: {
	        versions: {
	            melee: {
	                ideal: 1,
	                // additionalPer: {
	                //     count: 1,
	                //     flagPrefix: 'Keep'
	                // },
	                require: {
	                    energy: 250000
	                },
	                critical: 2300,
	                quota: {
	                    jobType: 'keep',
	                    allocation: 15
	                },
	                parts: { tough: 15, move: 16, attack: 15, heal: 2 },
	                actions: { selfheal: {} }
	            },
	            ranged: {
	                additionalPer: {
	                    count: 2,
	                    flagPrefix: 'Defend',
	                    max: 2
	                },
	                parts: { tough: 10, move: 10, ranged_attack: 10 },
	                rules: { defend: { ranged: true }, idle: { type: 'defend' } }
	            },
	            assault: {
	                additionalPer: {
	                    count: 5,
	                    flagPrefix: 'Idle-staging'
	                },
	                parts: { tough: 17, move: 16, attack: 15 },
	                rules: { attack: {}, defend: {}, idle: { type: 'staging' } }
	            }
	        },
	        rules: { defend: {}, keep: {}, idle: { type: 'keep' } }
	    }
	};

/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var Actions = __webpack_require__(5);
	var Work = __webpack_require__(11);

	class WorkManager {
	    static process(catalog){
	        var start = Game.cpu.getUsed();
	        var workers = Work(catalog);
	        var actions = Actions(catalog);
	        var creeps = _.filter(Game.creeps, creep => !creep.spawning);

	        _.forEach(creeps, creep => WorkManager.validateCreep(creep, workers, catalog));


	        var validate = Game.cpu.getUsed();
	        catalog.profile('work-validate', validate - start);
	        
	        var blocks = _.map(creeps, creep => WorkManager.creepAction(creep, actions, catalog));
	        
	        var startBid = Game.cpu.getUsed();
	        catalog.profile('work-block', startBid - validate);

	        _.forEach(creeps, creep => WorkManager.bidCreep(creep, workers, catalog, startBid));

	        var bid = Game.cpu.getUsed();
	        catalog.profile('work-bid', bid - startBid);

	        
	        _.forEach(creeps, (creep, ix) => WorkManager.processCreep(creep, workers, catalog, actions, blocks[ix]));
	        catalog.profile('work-process', Game.cpu.getUsed() - bid);
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

	    static creepAction(creep, actions, catalog){
	        var block = _.reduce(creep.memory.actions, (result, opts, type) => {
	            actions[type].preWork(creep, opts);
	            return actions[type].shouldBlock(creep, opts) || result;
	        }, false);
	        creep.memory.block = !!block;
	        return block;
	    }

	    static bidCreep(creep, workers, catalog, startTime){
	        if(!creep.memory.jobType){
	            if(Game.cpu.bucket < 5000 && Game.cpu.getUsed() - startTime > 10){
	                return;
	            }
	            var lowestBid = 99999999;
	            var bidder = _.reduce(creep.memory.rules, (result, rule, type) => {
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

	    static processCreep(creep, workers, catalog, actions, block){
	        var action = false;
	        if(creep.memory.jobType && !creep.memory.block){
	            var start = Game.cpu.getUsed();
	            action = workers[creep.memory.jobType].process(creep, creep.memory.rules[creep.memory.jobType]);
	            catalog.profileAdd('work-process-'+creep.memory.jobType, Game.cpu.getUsed() - start);
	        }
	        _.forEach(creep.memory.actions, (opts, type) => actions[type].postWork(creep, opts, action, block));
	    }
	}

	module.exports = WorkManager;

/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var Avoid = __webpack_require__(6);
	var MinecartAction = __webpack_require__(8);
	var Repair = __webpack_require__(9);
	var SelfHeal = __webpack_require__(10);

	module.exports = function(catalog){
	    return {
	        avoid: new Avoid(catalog),
	        minecart: new MinecartAction(catalog),
	        repair: new Repair(catalog),
	        selfheal: new SelfHeal(catalog)
	    };
	};

/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(7);

	class AvoidAction extends BaseAction {
	    constructor(catalog){
	        super(catalog, 'avoid');
	        this.range = 5;
	    }

	    shouldBlock(creep, opts){
	        var avoid = this.catalog.getAvoid(creep.pos);
	        if(avoid && avoid.length > 0){
	            var target = this.getJobTarget(creep);
	            var positions = _.filter(avoid, pos => creep.pos.getRangeTo(pos) < this.range);
	            if(positions.length > 0){
	                return _.map(positions, position => {
	                    return { pos: position, range: this.range };
	                });
	            }
	        }
	        return false;
	    }

	    postWork(creep, opts, action, block){
	        if(block){
	            creep.memory.avoidUntil = Game.time + 10;
	            delete creep.memory._move;
	            var result = PathFinder.search(creep.pos, block, { flee: true });
	            creep.move(creep.pos.getDirectionTo(result.path[0]));
	        }
	    }
	}


	module.exports = AvoidAction;

/***/ },
/* 7 */
/***/ function(module, exports) {

	"use strict";

	class BaseAction {
	    constructor(catalog, type){
	        this.catalog = catalog;
	        this.type = type;
	    }

	    preWork(creep, opts){}

	    shouldBlock(creep, opts){
	        return false;
	    }

	    postWork(creep, opts, action, block){}

	    hasJob(creep){
	        return creep.memory.jobId && creep.memory.jobType;
	    }

	    getJobTarget(creep){
	        var job = this.catalog.jobs.getJob(creep.memory.jobType, creep.memory.jobId);
	        if(job && job.target){
	            return job.target;
	        }
	        if(creep.memory.jobId){
	            return Game.getObjectById(creep.memory.jobId);
	        }
	        return false;
	    }

	}

	module.exports = BaseAction;

/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(7);

	var offsets = {
	    container: 0.5,
	    storage: 0.25,
	    link: 0,
	};

	class MinecartAction extends BaseAction {
	    constructor(catalog){
	        super(catalog, 'minecart');
	    }

	    postWork(creep, opts, action){
	        if(_.sum(creep.carry) > creep.carryCapacity * 0.8){
	            var containers = this.catalog.lookForArea(creep.room, creep.pos, LOOK_STRUCTURES, 2);
	            var targets = _.filter(containers, struct => (struct.structureType == STRUCTURE_CONTAINER || struct.structureType == STRUCTURE_STORAGE || struct.structureType == STRUCTURE_LINK) && this.catalog.notFull(struct));
	            var nearby = _.sortBy(targets, target => offsets[target.structureType]);
	            if(nearby.length > 0){
	                _.forEach(creep.carry, (amount, type)=>{
	                    if(amount > 0){
	                        if(creep.transfer(nearby[0], type) == ERR_NOT_IN_RANGE){
	                            creep.moveTo(nearby[0]);
	                        }
	                    }
	                });
	            }
	        }
	    }
	}


	module.exports = MinecartAction;

/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(7);

	class RepairAction extends BaseAction {
	    constructor(catalog){
	        super(catalog, 'repair');
	    }

	    postWork(creep, opts, action){
	        if(!action && creep.carry.energy > creep.carryCapacity / 4){
	            var structures = creep.room.lookForAtArea(LOOK_STRUCTURES, Math.max(0, creep.pos.y - 3), Math.max(0, creep.pos.x - 3), Math.min(49, creep.pos.y + 3), Math.min(49, creep.pos.x + 3), true);
	            var targets = _.filter(structures, struct => struct.structure.hits < Math.min(struct.structure.hitsMax, Memory.settings.repairTarget));
	            if(targets.length > 0){
	                creep.repair(targets[0].structure);
	            }
	        }
	    }
	}


	module.exports = RepairAction;

/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(7);

	class SelfHealAction extends BaseAction {
	    constructor(catalog){
	        super(catalog, 'selfheal');
	    }

	    postWork(creep, opts, action){
	        if(!action && creep.hits < creep.hitsMax){
	            creep.heal(creep);
	        }
	    }
	}


	module.exports = SelfHealAction;

/***/ },
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var Attack = __webpack_require__(12);
	var Build = __webpack_require__(15);
	var Defend = __webpack_require__(16);
	var Deliver = __webpack_require__(17);
	var Drop = __webpack_require__(18);
	var Heal = __webpack_require__(19);
	var Idle = __webpack_require__(20);
	var Keep = __webpack_require__(21);
	var Mine = __webpack_require__(22);
	var Observe = __webpack_require__(23);
	var Pickup = __webpack_require__(24);
	var Repair = __webpack_require__(25);
	var Reserve = __webpack_require__(27);
	var Transfer = __webpack_require__(28);
	var Upgrade = __webpack_require__(29);

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
	        transfer: new Transfer(catalog),
	        upgrade: new Upgrade(catalog)
	    };
	};

/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(13);

	class AttackWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'attack', { chatty: true, moveOpts: { ignoreDestructibleStructures: true, reusePath: 4 } }); }

	    calculateAllocation(creep, opts){
	        return creep.getActiveBodyparts(ATTACK) + creep.getActiveBodyparts(RANGED_ATTACK);
	    }

	    canBid(creep, opts){
	        if(creep.hits < creep.hitsMax / 1.5){
	            return false;
	        }
	        return true;
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        return distance / this.distanceWeight - 99;
	    }

	    processStep(creep, job, target, opts){
	        if(!target.room){
	            this.move(creep, target);
	            return;
	        }
	        if(opts.ranged){
	            if(creep.pos.getRangeTo(target) > 3){
	                this.move(creep, target);
	            }else{
	                creep.rangedAttack(target);
	            }
	        }else{
	            if(creep.getActiveBodyparts(RANGED_ATTACK) > 0 && creep.pos.getRangeTo(target) <= 3){
	                creep.rangedAttack(target);
	            }
	            return this.orMove(creep, target, creep.attack(target)) == OK;
	        }
	    }

	}

	module.exports = AttackWorker;

/***/ },
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var SimpleWorker = __webpack_require__(14);

	class BaseWorker extends SimpleWorker {
	    constructor(catalog, type, opts){
	        super(catalog, type, opts);
	    }

	    getOpenJobs(){
	        return this.catalog.jobs.getOpenJobs(this.type);
	    }

	    getOpenSubJobs(subtype){
	        return this.catalog.jobs.getOpenSubJobs(this.type, subtype);
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
	        var jobs;
	        if(_.isUndefined(opts.subtype)){
	            jobs = this.getOpenJobs()
	        }else{
	            jobs = this.getOpenSubJobs(opts.subtype);
	        }
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
	            return false;
	        }
	        return this.processStep(creep, job, job.target, opts);
	    }

	    processStep(creep, job, target, opts){ console.log('processStep not implemented', this.type); }

	}

	module.exports = BaseWorker;

/***/ },
/* 14 */
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

	    move(creep, target){
	        if(this.moveOpts){
	            return creep.moveTo(target, this.moveOpts);
	        }
	        if(creep.memory.avoidUntil > Game.time && Game.cpu.bucket > 5000){
	            var range = 5;
	            return creep.moveTo(target, { reusePath: 15, costCallback: (roomName, costMatrix) => {
	                var avoidList = this.catalog.getAvoid({ roomName });
	                if(!avoidList){
	                    return;
	                }
	                for(var avoid of avoidList){
	                    var minX = Math.max(0, avoid.x - range);
	                    var minY = Math.max(0, avoid.y - range);
	                    var maxX = Math.min(49, avoid.x + range);
	                    var maxY = Math.min(49, avoid.y + range);
	                    for(var iy = minY; iy < maxY; iy++){
	                        for(var ix = minX; ix < maxX; ix++){
	                            costMatrix.set(ix, iy, 256);
	                        }
	                    }
	                }
	            }});
	        }
	        
	        return creep.moveTo(target, { reusePath: 15 });
	    }

	    orMove(creep, target, result){
	        if(result == ERR_NOT_IN_RANGE){
	            this.move(creep, target);
	        }
	        return result;
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
	    
	    process(creep, opts){ return false; }
	    
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
/* 15 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(13);

	class BuildWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'build', { requiresEnergy: true, chatty: true }); }

	    calculateAllocation(creep, opts){
	        return 1;
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        return this.getEnergyOffset(creep) + distance / this.distanceWeight + job.offset;
	    }

	    processStep(creep, job, target, opts){
	        this.orMove(creep, target, creep.build(target));
	    }

	}

	module.exports = BuildWorker;

/***/ },
/* 16 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(13);

	class DefendWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'defend', { flagPrefix: 'Defend', chatty: true, moveOpts: { ignoreDestructibleStructures: true, reusePath: 3 } }); }

	    calculateAllocation(creep, opts){
	        return creep.getActiveBodyparts(ATTACK) + creep.getActiveBodyparts(RANGED_ATTACK);
	    }

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
	                this.move(creep, target);
	            }else{
	                creep.rangedAttack(target);
	            }
	            if(creep.pos.getRangeTo(target) < 3){
	                creep.move((creep.pos.getDirectionTo(target)+4)%8);
	            }
	        }else{
	            if(creep.getActiveBodyparts(RANGED_ATTACK) > 0 && creep.pos.getRangeTo(target) <= 3){
	                creep.rangedAttack(target);
	            }
	            return this.orMove(creep, target, creep.attack(target)) == OK;
	        }
	    }

	}

	module.exports = DefendWorker;

/***/ },
/* 17 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(13);

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
	        var distanceOffset = opts.ignoreDistance ? 0 : distance / _.get(opts, 'distanceWeight', this.distanceWeight);
	        if(this.catalog.hasMinerals(creep)){
	            if(!job.minerals || !job.target.structureType || !_.includes(opts.mineralTypes || mineralTypes, job.target.structureType)){
	                return false;
	            }
	            return this.getStorageOffset(creep) + distanceOffset + this.catalog.getStoragePercent(job.target)/10 + job.offset;
	        }else{
	            if(job.target.structureType && !_.includes(opts.types || defaultTypes, job.target.structureType)){
	                return false;
	            }
	            return this.getStorageOffset(creep) + distanceOffset + this.catalog.getResourcePercent(job.target, RESOURCE_ENERGY)/10 + job.offset;
	        }
	    }

	    processStep(creep, job, target, opts){
	        var done = false;
	        var total = 0;
	        _.forEach(this.catalog.getResourceList(creep), (amount, type) => {
	            if(done){
	                return;
	            }
	            var result = creep.transfer(target, type);
	            if(result == ERR_NOT_IN_RANGE){
	                this.move(creep, target);
	                done = true;
	            }else if(result == OK){
	                total += amount;
	                done = true;
	            }
	        });
	        if(opts.profile && total > 0){
	            if(creep.memory.lastPickupTime > 0 && creep.memory.lastDeliveryTime > 0){
	                var ticks = Game.time - creep.memory.lastPickupTime;
	                var totalticks = Game.time - creep.memory.lastDeliveryTime;
	                var eps = total / totalticks;
	                this.catalog.profile('delivery', eps);
	            }
	            creep.memory.lastDeliveryTime = Game.time;
	        }
	    }

	}

	module.exports = DeliverWorker;

/***/ },
/* 18 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var SimpleWorker = __webpack_require__(14);

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
/* 19 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(13);

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
	            this.move(creep, target);
	        }else if(creep.heal(target) == ERR_NOT_IN_RANGE){
	            this.move(creep, target);
	        }
	    }

	}

	module.exports = HealWorker;

/***/ },
/* 20 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(13);

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
	            this.move(creep, target);
	        }
	    }

	}

	module.exports = IdleWorker;

/***/ },
/* 21 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(13);

	class KeepWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'keep'); }

	    isValid(creep, opts, job, target){
	        return job.capacity >= job.allocated && _.get(Memory.stats.rooms, [target.pos.roomName, 'hostileCount'], 0) == 0;
	    }

	    calculateAllocation(creep, opts){
	        return creep.getActiveBodyparts(ATTACK) + creep.getActiveBodyparts(RANGED_ATTACK);
	    }

	    canBid(creep, opts){
	        if(creep.hits < creep.hitsMax / 1.25){
	            return false;
	        }
	        return true;
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        if(job.target.ticksToSpawn > creep.ticksToLive){
	            return false;
	        }
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
	            return this.orMove(creep, enemy, creep.attack(enemy)) == OK;
	        }else if(creep.pos.getRangeTo(target) > targetRange){
	            this.move(creep, target);
	        }else if(creep.pos.getRangeTo(target) < targetRange){
	            creep.move((creep.pos.getDirectionTo(target)+4)%8);
	        }
	    }

	}

	module.exports = KeepWorker;

/***/ },
/* 22 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(13);

	class MineWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'mine'); }

	    isValid(creep, opts, job, target){
	        return this.catalog.getAvailableCapacity(creep) > 0;
	    }

	    canBid(creep, opts){
	        return !this.catalog.isFull(creep);
	    }

	    calculateAllocation(creep, opts){
	        if(creep.ticksToLive < 100){
	            return Math.ceil(creep.getActiveBodyparts(WORK) / 2);
	        }
	        return creep.getActiveBodyparts(WORK);
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        return this.catalog.getResourcePercent(creep, RESOURCE_ENERGY) + distance / this.distanceWeight;
	    }

	    processStep(creep, job, target, opts){
	        this.orMove(creep, target, creep.harvest(target));
	        if(creep.ticksToLive == 100){
	            creep.memory.jobAllocation = Math.ceil(creep.memory.jobAllocation / 2);
	        }
	    }

	}

	module.exports = MineWorker;

/***/ },
/* 23 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(13);

	class ObserveWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'observe', { idleTimer: 50 }); }

	    calculateAllocation(creep, opts){
	        return 1;
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        return distance/this.distanceWeight;
	    }

	    processStep(creep, job, target, opts){
	        if(creep.pos.getRangeTo(target) > 1){
	            this.move(creep, target);
	        }
	    }

	}

	module.exports = ObserveWorker;

/***/ },
/* 24 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(13);

	class PickupWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'pickup'); }

	    isValid(creep, opts, job, target){
	        return !this.catalog.isFull(creep) && this.catalog.getResource(target, job.resource) > 0;
	    }

	    canBid(creep, opts){
	        return !this.catalog.isFull(creep) && creep.ticksToLive > 30;
	    }

	    calculateAllocation(creep, opts){
	        return creep.carryCapacity;
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        var distanceWeight = opts.distanceWeight || this.distanceWeight;
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
	        return 1 + this.getStorageOffset(creep) + distance / distanceWeight + this.calcAvailRatio(job, allocation);
	    }

	    processStep(creep, job, target, opts){
	        var result;
	        if(target.resourceType){
	            result = creep.pickup(target);
	        }else{
	            result = creep.withdraw(target, job.resource);
	        }
	        if(result == ERR_NOT_IN_RANGE){
	            this.move(creep, target);
	        }else if(result == OK){
	            creep.memory.lastSource = target.id;
	            creep.memory.lastPickupTime = Game.time;
	        }
	    }

	}

	module.exports = PickupWorker;

/***/ },
/* 25 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var StaticWorker = __webpack_require__(26);

	class RepairWorker extends StaticWorker {
	    constructor(catalog){ super(catalog, 'repair', { requiresEnergy: true, chatty: true }); }

	    isValid(creep, opts, target){
	        return target.hits < Math.min(target.hitsMax, Memory.settings.repairTarget);
	    }

	    canBid(creep, opts, target){
	        return target.hits < Math.min(target.hitsMax, Memory.settings.repairTarget);
	    }

	    processStep(creep, target, opts){
	        return this.orMove(creep, target, creep.repair(target)) == OK;
	    }

	}

	module.exports = RepairWorker;

/***/ },
/* 26 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var SimpleWorker = __webpack_require__(14);

	class StaticWorker extends SimpleWorker {
	    constructor(catalog, type, opts){
	        super(catalog, type, opts);
	        this.capacity = this.capacity || 1;
	    }

	    stillValid(creep, opts){
	        var target = Game.getObjectById(creep.memory.jobId);
	        return target && super.stillValid(creep, opts) && this.isValid(creep, opts, target);
	    }

	    isValid(creep, opts, target){
	        return true;
	    }

	    getTargets(){
	        var jobs = Memory.jobs[this.type];
	        if(jobs && jobs.length > 0){
	            return jobs;
	        }
	        return [];
	    }

	    bid(creep, opts){
	        if(!this.shouldBid(creep, opts)){
	            return false;
	        }
	        var targetId = _.find(this.getTargets(), jobId => {
	            var target = Game.getObjectById(jobId);
	            var allocated = _.get(this.catalog.jobs.staticAllocation, [this.type, jobId], 0);
	            return target && allocated < this.capacity && this.canBid(creep, opts, target);
	        });
	        var finalTarget = Game.getObjectById(targetId);
	        // console.log(creep, 'bid for', finalTarget, _.get(this.catalog.jobs.staticAllocation, [this.type, targetId], 0), targetId);
	        if(finalTarget){
	            return {
	                job: { id: finalTarget.id, target: finalTarget },
	                type: this.type,
	                allocation: 1,
	                bid: this.calculateBid(creep, opts, finalTarget)
	            }
	        }
	        return false;
	    }

	    canBid(creep, opts, target){
	        return true;
	    }

	    shouldBid(creep, opts){
	        if(this.requiresEnergy){
	            return creep.carry.energy > 0;
	        }else{
	            return true;
	        }
	    }

	    calculateBid(creep, opts, target){
	        var distance = this.catalog.getRealDistance(creep, target) / this.distanceWeight;
	        if(this.requiresEnergy){
	            return (1 - creep.carry.energy / creep.carryCapacity) / 5 + distance;
	        }else{
	            return distance;
	        }
	    }

	    process(creep, opts){
	        var target = Game.getObjectById(creep.memory.jobId);
	        if(!target){
	            return false;
	        }
	        return this.processStep(creep, target, opts);
	    }

	    processStep(creep, target, opts){
	        return false;
	    }

	}

	module.exports = StaticWorker;

/***/ },
/* 27 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(13);

	class ReserveWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'reserve'); }

	    calculateAllocation(creep, opts){
	        return creep.getActiveBodyparts(CLAIM);
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        if(!opts.downgrade && job.downgrade){
	            return false;
	        }
	        return distance/this.distanceWeight;
	    }

	    processStep(creep, job, target, opts){
	        if(target.name){
	            this.move(creep, target);
	        }else if(job.downgrade && opts.downgrade){
	            this.orMove(creep, target, creep.attackController(target));
	        }else if(job.claim){
	            this.orMove(creep, target, creep.claimController(target));
	        }else if(creep.reserveController(target) == ERR_NOT_IN_RANGE){
	            this.move(creep, target);
	        }
	    }

	}

	module.exports = ReserveWorker;

/***/ },
/* 28 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(13);

	class TransferWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'transfer', { chatty: true }); }

	    isValid(creep, opts, job, target){
	        var resources = this.catalog.getResource(creep, job.resource);
	        if(resources == 0){
	            return this.catalog.getResource(job.pickup, job.resource) > 0;
	        }else{
	            if(job.resource == RESOURCE_ENERGY && target.energyCapacity > 0){
	                return (target.energyCapacity - target.energy) > 0;
	            }
	            return this.catalog.getAvailableCapacity(target) > 0;
	        }
	    }

	    calculateAllocation(creep, opts){
	        return this.catalog.getCapacity(creep);
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        var holding = this.catalog.getResource(creep, job.resource);
	        if(this.catalog.getStoragePercent(creep) > 0.5 && holding == 0){
	            return false;
	        }
	        if(!job.pickup || this.catalog.getResource(job.pickup, job.resource) == 0){
	            return false;
	        }
	        return distance / this.distanceWeight + (1 - job.amount / creep.carryCapacity);
	    }

	    processStep(creep, job, target, opts){
	        var resources = this.catalog.getResource(creep, job.resource);
	        if(resources > 0){
	            creep.memory.jobAllocation = resources;
	            this.orMove(creep, target, creep.transfer(target, job.resource, Math.min(resources, job.amount)));
	        }else{
	            var amount = Math.min(this.catalog.getAvailableCapacity(creep), Math.min(this.catalog.getResource(job.pickup, job.resource), job.amount));
	            this.orMove(creep, job.pickup, creep.withdraw(job.pickup, job.resource, amount));
	        }
	    }

	}

	module.exports = TransferWorker;

/***/ },
/* 29 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(13);

	class UpgradeWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'upgrade', { requiresEnergy: true, chatty: true, idleTimer: 50 }); }

	    calculateAllocation(creep, opts){
	        return creep.getActiveBodyparts(WORK);
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        return this.getEnergyOffset(creep) + distance / this.distanceWeight;
	    }

	    processStep(creep, job, target, opts){
	        this.orMove(creep, target, creep.upgradeController(target));
	    }

	}

	module.exports = UpgradeWorker;

/***/ },
/* 30 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var JobManager = __webpack_require__(31);
	var QuotaManager = __webpack_require__(49);

	var roomRegex = /([WE])(\d+)([NS])(\d+)/;

	class Catalog {
	    constructor(){
	        //DEPRECATED
	        //TODO remove
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
	        this.storedResources = {};
	        this.labResources = {};

	        this.flagsPrefix = {};

	        this.creeps = {
	            class: _.groupBy(Game.creeps, creep => creep.memory.class),
	            type: _.groupBy(Game.creeps, creep => creep.memory.type),
	            room: _.groupBy(Game.creeps, creep => creep.pos.roomName)
	        };

	        // console.log(this.creeps.type.meleefighter);

	        this.buildings = _.groupBy(Game.structures, structure => structure.structureType);
	        // _.forEach(this.buildings, (list, type)=>console.log(type, list.length));

	        this.rooms = _.filter(Game.rooms, 'controller.my');
	        this.avoid = {};

	        this.jobs = new JobManager(this);

	        this.quota = new QuotaManager(this);

	        //class
	        this.deficits = {};

	        this.profileData = {};

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

	    getStorageContainers(resourceType){
	        if(!resourceType){
	            resourceType = RESOURCE_ENERGY;
	        }
	        return _.filter(this.buildings.storage.concat(this.buildings.terminal), structure => this.getResource(structure, resourceType) > 0);
	    }

	    getDroppedResources(room){
	        if(!room.name){ return []; }
	        if(!this.droppedResources[room.name]){
	            this.droppedResources[room.name] = room.find(FIND_DROPPED_RESOURCES);
	        }
	        return this.droppedResources[room.name];
	    }

	    getTotalStored(resource){
	        var total = _.get(this.storedResources, resource, false);
	        if(total === false){
	            var containers = this.getStorageContainers(resource);
	            total = _.reduce(containers, (result, container) => result + this.getResource(container, resource), 0);
	            this.storedResources[resource] = total;
	        }
	        return total;
	    }

	    getTotalLabResources(resource){
	        var total = _.get(this.labResources, resource, false);
	        if(total === false){
	            var containers = _.filter(this.buildings.lab, structure => this.getResource(structure, resource) > 0);
	            total = _.reduce(containers, (result, container) => result + this.getResource(container, resource), 0);
	            this.labResources[resource] = total;
	        }
	        return total;
	    }

	    getAccessibility(pos, room){
	        var name = pos.roomName + '-' + pos.x + '-'  + pos.y;
	        var access = _.get(Memory.accessibility, name, false);
	        if(access === false){
	            access = 0;
	            if(room){
	                var area = room.lookForAtArea(LOOK_TERRAIN, pos.y - 1, pos.x - 1, pos.y + 1, pos.x + 1, true);
	                _.forEach(area, (target)=>{
	                    if(!(target.x == pos.x && target.y == pos.y) && target.terrain != 'wall'){
	                        access++;
	                    }
	                });
	                console.log('cached pos availability', pos, room, access);
	                Memory.accessibility[name] = access;
	            }
	        }
	        return access;
	    }

	    lookForArea(room, pos, type, radius){
	        return _.map(room.lookForAtArea(type, Math.max(0, pos.y - radius), Math.max(0, pos.x - radius), Math.min(49, pos.y + radius), Math.min(49, pos.x + radius), true), type);
	    }

	    getResource(entity, type){
	        if(!entity){
	            return 0;
	        }
	        if(!type){
	            type = RESOURCE_ENERGY;
	        }
	        if(entity.carryCapacity > 0){
	            return _.get(entity.carry, type, 0);
	        }else if(entity.storeCapacity > 0){
	            return _.get(entity.store, type, 0);
	        }else if(entity.mineralCapacity > 0 && type === entity.mineralType){
	            return entity.mineralAmount;
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
	        }else if(entity.mineralCapacity > 0 && entity.mineralAmount > 0){
	            result[entity.mineralType] = entity.mineralAmount;
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
	        }else if(entity.mineralCapacity > 0){
	            return entity.mineralCapacity;
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
	        }else if(entity.mineralCapacity > 0){
	            return entity.mineralAmount;
	        }else if(entity.energyCapacity > 0){
	            return entity.energy;
	        }else if(entity.resourceType && entity.amount > 0){
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
	        return Math.max(Math.abs(posA.x - posB.x), Math.abs(posA.y-posB.y));
	    }

	    sortByDistance(entity, targets){
	        return _.sortBy(targets, target => this.getRealDistance(entity, target));
	    }

	    addAvoid(pos){
	        if(!_.has(this.avoid, pos.roomName)){
	            this.avoid[pos.roomName] = [];
	        }
	        this.avoid[pos.roomName].push(pos);
	    }

	    getAvoid(pos){
	        return this.avoid[pos.roomName];
	    }

	    profile(type, value){
	        if(!_.has(Memory.stats.profile.misc, type)){
	            Memory.stats.profile.misc[type] = value;
	            Memory.stats.profile.miscCount[type] = 1;
	        }else{
	            Memory.stats.profile.misc[type] = (Memory.stats.profile.misc[type]*Memory.stats.profile.miscCount[type] + value)/(Memory.stats.profile.miscCount[type]+1);
	            Memory.stats.profile.miscCount[type]++;
	        }
	    }

	    profileAdd(type, value){
	        _.set(this.profileData, type, _.get(this.profileData, type, 0) + value);
	    }

	    finishProfile(){
	        _.forEach(this.profileData, (value, type) => this.profile(type, value));
	    }
	}

	module.exports = Catalog;

/***/ },
/* 31 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var Jobs = __webpack_require__(32);

	class JobManager {
	    constructor(catalog){
	        this.catalog = catalog;
	        this.jobs = {};
	        this.subjobs = {};
	        this.openJobs = {};
	        this.openSubJobs = {};
	        this.capacity = {};
	        this.allocation = {};
	        this.staticAllocation = {};
	        this.categories = Jobs(catalog);
	    }

	    generate(){
	        _.forEach(this.categories, (category, categoryName) =>{
	            var start = Game.cpu.getUsed();
	            var cap = 0;
	            var type = category.getType();
	            var jobList = category.generate();
	            this.jobs[type] = jobList;
	            _.forEach(jobList, (job, id)=>{
	                cap += job.capacity;
	                if(job.subtype){
	                    var fullType = type+'-'+job.subtype;
	                    _.set(this.subjobs, [fullType, id], job);
	                    this.capacity[fullType] = job.capacity + _.get(this.capacity, fullType, 0);
	                }else{
	                    _.set(this.subjobs, [type, id], job);
	                }
	            });
	            if(category.static){
	                cap = _.size(Memory.jobs[type]);
	            }
	            this.capacity[type] = cap;
	            this.allocation[type] = 0;
	            this.catalog.profile('job-'+categoryName, Game.cpu.getUsed() - start);
	        });
	            // _.forEach(this.subjobs, (list, type) => console.log(type, _.size(list), this.capacity[type]));
	        if(Memory.debugJob){
	            _.forEach(this.jobs[Memory.debugJob], (job, type) => console.log(type, job.target, job.capacity));
	        }
	    }

	    allocate(){
	        var start = Game.cpu.getUsed();
	        _.forEach(Game.creeps, creep => this.addAllocation(creep.memory.jobType, creep.memory.jobId, creep.memory.jobAllocation));
	        this.catalog.profile('job-allocate', Game.cpu.getUsed() - start);
	    }

	    getOpenJobs(type){
	        if(!this.openJobs[type]){
	            this.openJobs[type] = _.pick(this.jobs[type], job => job.allocated < job.capacity);
	        }
	        return this.openJobs[type];
	    }

	    getOpenSubJobs(type, subtype){
	        var fullType = subtype === false ? type : type+'-'+subtype;
	        if(!this.openSubJobs[fullType]){
	            this.openSubJobs[fullType] = _.pick(this.subjobs[fullType], job => job.allocated < job.capacity);
	        }
	        return this.openSubJobs[fullType];
	    }

	    getJob(type, id){
	        return _.get(this.jobs, [type, id], false);
	    }

	    addAllocation(type, jobId, allocation){
	        if(jobId && type){
	            var full = this.categories[type].addAllocation(this.jobs[type], jobId, allocation);
	            this.allocation[type] += allocation;
	            if(full && _.has(this.openJobs, [type, jobId])){
	                delete this.openJobs[type][jobId];
	            }
	        }
	    }

	    removeAllocation(type, jobId, allocation){
	        if(jobId && type && _.has(this.jobs, [type, jobId])){
	            var recalc = this.categories[type].removeAllocation(this.jobs[type], jobId, allocation);
	            this.allocation[type] -= allocation;
	            if(recalc && !_.has(this.openJobs, [type, jobId])){
	                this.openJobs[type] = _.pick(this.jobs[type], job => job.allocated < job.capacity);
	            }
	        }
	    }
	}

	module.exports = JobManager;

/***/ },
/* 32 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var Attack = __webpack_require__(33);
	var Build = __webpack_require__(35);
	var Defend = __webpack_require__(36);
	var Deliver = __webpack_require__(37);
	var Mine = __webpack_require__(38);
	var Idle = __webpack_require__(39);
	var Keep = __webpack_require__(40);
	var Observe = __webpack_require__(41);
	var Pickup = __webpack_require__(42);
	var Repair = __webpack_require__(43);
	var Reserve = __webpack_require__(45);
	var Transfer = __webpack_require__(46);
	var Upgrade = __webpack_require__(47);
	var Heal = __webpack_require__(48);

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
	        transfer: new Transfer(catalog),
	        upgrade: new Upgrade(catalog)
	    };
	};

/***/ },
/* 33 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(34);

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
	            var towers = flag.room.find(FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
	            if(towers.length > 0){
	                return _.map(towers, target => this.generateJobForTarget(flag.room, target));
	            }
	            var structures = _.filter(flag.room.find(FIND_HOSTILE_STRUCTURES), structure => structure.structureType != STRUCTURE_CONTROLLER);
	            var targets = _.filter(this.catalog.getHostileCreeps(flag.room), enemy => flag.pos.getRangeTo(enemy) <= Memory.settings.flagRange.attack);
	            if(structures.length > 0){
	                targets = targets.concat(structures);
	            }
	            if(targets.length > 0){
	                return _.map(targets, target => this.generateJobForTarget(flag.room, target));
	            }
	        }else{
	            return [this.generateJobForTarget(flag.room, flag, flag)];
	        }
	        return [];
	    }
	}

	module.exports = AttackJob;



/***/ },
/* 34 */
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

	    generate(){
	        var jobs = {};
	        _.forEach(this.catalog.rooms, room => _.forEach(this.generateJobs(room), job => jobs[job.id] = job));
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

	    addAllocation(jobs, jobId, allocation){
	        if(jobId && _.has(jobs, jobId)){
	            _.set(jobs, [jobId, 'allocated'], _.get(jobs, [jobId, 'allocated'], 0) + allocation);
	            var job = _.get(jobs, jobId, false);
	            return job && job.allocated >= job.capacity;
	        }
	        return false;
	    }

	    removeAllocation(jobs, jobId, allocation){
	        if(jobId && _.has(jobs, jobId)){
	            _.set(jobs, [jobId, 'allocated'], _.get(jobs, [jobId, 'allocated'], 0) - allocation);
	            var job = _.get(jobs, jobId, false);
	            return job && job.allocated < job.capacity;
	        }
	        return false;
	    }

	    getSubflag(flag){
	        var flagparts = flag.name.split('-');
	        if(flagparts.length > 2){
	            return flagparts[1];
	        }
	        return false;
	    }

	}

	module.exports = BaseJob;

/***/ },
/* 35 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(34);

	var offsets = {
	    container: -0.5,
	    tower: -1,
	    extension: -0.25,
	    road: 0.5,
	    constructedWall: 1,
	    rampart: 1,
	    spawn: -1
	}

	class BuildJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'build'); }

	    calculateCapacity(room, target){
	        return Math.min(4, Math.ceil((target.progressTotal - target.progress) / 1000));
	    }

	    generate(){
	        var jobs = {};
	        _.forEach(_.map(Game.constructionSites, target => this.generateJobForTarget(null, target)), job => jobs[job.id] = job);
	        return jobs;
	    }

	    generateJobForTarget(room, target, flag){
	        var job = super.generateJobForTarget(room, target, flag);
	        job.offset = _.get(offsets, target.structureType, 0);
	        return job;
	    }
	}

	module.exports = BuildJob;

/***/ },
/* 36 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(34);

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
	        this.catalog.addAvoid(target.pos);
	        return job;
	    }
	}

	module.exports = DefendJob;



/***/ },
/* 37 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(34);

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
	    STRUCTURE_LINK,
	    STRUCTURE_TOWER
	];

	var mineralContainers = [
	    STRUCTURE_STORAGE
	];

	class DeliverJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'deliver'); }

	    generateJobs(room){
	        var energyNeeds = _.filter(this.catalog.getStructuresByType(room, types), structure => this.catalog.getAvailableCapacity(structure) > 0);
	        return _.map(energyNeeds, entity => {
	            return {
	                allocated: 0,
	                capacity: this.catalog.getAvailableCapacity(entity),
	                id: this.generateId(entity),
	                target: entity,
	                creep: false,//this.catalog.isCreep(entity),
	                offset: this.getOffset(entity.structureType, entity),
	                minerals: _.includes(mineralContainers, entity.structureType),
	                subtype: (entity.structureType == STRUCTURE_EXTENSION || entity.structureType == STRUCTURE_SPAWN || entity.structureType == STRUCTURE_TOWER) ? 'spawn' : false
	            }
	        });
	    }

	    getOffset(type, entity){
	        if(!type){
	            return 0;
	        }
	        return _.get(offsets, type, 0);
	    }
	}

	module.exports = DeliverJob;

/***/ },
/* 38 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(34);

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
	        //TODO check ownership/reservation
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
/* 39 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(34);

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
/* 40 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(34);

	class KeepJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'keep', { flagPrefix: 'Keep' }); }

	    calculateCapacity(room, target){
	        var access = Math.min(2, this.catalog.getAccessibility(target.pos, room));
	        if(target.ticksToSpawn > 60 && target.ticksToSpawn < 100){
	            return 15;
	        }else if(target.ticksToSpawn >= 100 && target.ticksToSpawn < 280){
	            return 0;
	        }
	        return 15 * access;
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
	        if(!(target.ticksToSpawn > 15 && target.ticksToSpawn < 295)){
	            this.catalog.addAvoid(target.pos);
	        }
	        return job;
	    }
	}

	module.exports = KeepJob;



/***/ },
/* 41 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(34);

	class ObserveJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'observe', { flagPrefix: 'Observe' }); }

	    generateJobsForFlag(flag){
	        var subflag = this.getSubflag(flag);
	        return [{
	            allocated: 0,
	            capacity: subflag ? 5 : 1,
	            id: this.type+"-"+flag.name,
	            target: flag,
	            subtype: subflag
	        }];
	    }
	}

	module.exports = ObserveJob;

/***/ },
/* 42 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(34);

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
	                    resource: type,
	                    subtype: !!flag ? 'remote' : type != RESOURCE_ENERGY ? 'mineral' : false
	                });
	            });
	        }, []);
	        return result;
	    }
	}

	module.exports = PickupJob;

/***/ },
/* 43 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var StaticJob = __webpack_require__(44);

	class RepairJob extends StaticJob {
	    constructor(catalog){ super(catalog, 'repair', { flagPrefix: 'Repair', refresh: 20 }); }

	    generateTargets(room){
	        return _.filter(this.catalog.getStructures(room), structure => structure.hits < Math.min(structure.hitsMax, Memory.settings.repairTarget));
	    }

	    finalizeTargetList(targets){
	        var sorted = _.sortBy(targets, structure => structure.hits / Math.min(structure.hitsMax, Memory.settings.repairTarget));
	        if(sorted.length < 30){
	            return sorted;
	        }
	        return _.slice(sorted, 0, 30);
	    }

	}

	module.exports = RepairJob;

/***/ },
/* 44 */
/***/ function(module, exports) {

	"use strict";

	class StaticJob {
	    constructor(catalog, type, opts){
	        this.catalog = catalog;
	        this.refresh = 0;
	        this.capacity = 1;
	        this.static = true;
	        this.type = type;
	        if(opts){
	            _.assign(this, opts);
	        }
	        this.generateJob = this.generateJob.bind(this);
	    }

	    getType(){
	        return this.type;
	    }

	    generateId(entity){
	        return (entity.id || entity.name);
	    }

	    generate(){
	        if(this.refresh > 0){
	            if(_.get(Memory.jobUpdateTime, this.type, 0) > Game.time){
	                return {};
	            }
	            Memory.jobUpdateTime[this.type] = Game.time + this.refresh;
	        }

	        var targetLists = _.map(this.catalog.rooms, room => this.generateTargets(room));
	        if(this.flagPrefix){
	            var flagTargetLists = _.map(this.catalog.getFlagsByPrefix(this.flagPrefix), flag => this.generateTargetsForFlag(flag));
	            if(flagTargetLists.length > 0){
	                targetLists = targetLists.concat(flagTargetLists);
	            }
	        }
	        var finalTargets = this.finalizeTargetList(_.flatten(targetLists));

	        Memory.jobs[this.type] = this.generateJobs(finalTargets);
	        return {};
	    }

	    generateJobs(targets){
	        return _.map(targets, this.generateJob);
	    }

	    generateJob(target){
	        return target.id;
	    }

	    calculatePriority(target){
	        return 0;
	    }

	    finalizeTargetList(targets){
	        return targets;
	    }

	    generateTargets(room, flag){
	        return [];
	    }

	    generateTargetsForUnknownRoom(name, flag){
	        return [];
	    }

	    generateTargetsForFlag(flag){
	        if(flag.room){
	            return this.generateTargets(flag.room, flag);
	        }
	        return this.generateTargetsForUnknownRoom(flag.pos.roomName, flag);
	    }

	    addAllocation(jobs, jobId, allocation){
	        if(jobId){
	            _.set(this.catalog.jobs.staticAllocation, [this.type, jobId], _.get(this.catalog.jobs.staticAllocation, [this.type, jobId], 0) + allocation);
	            // console.log('add', jobId, _.get(this.catalog.jobs.staticAllocation, [this.type, jobId], 0));
	        }
	        return false;
	    }

	    removeAllocation(jobs, jobId, allocation){
	        if(jobId){
	            _.set(this.catalog.jobs.staticAllocation, [this.type, jobId], _.get(this.catalog.jobs.staticAllocation, [this.type, jobId], 0) - allocation);
	            console.log('remove', jobId, _.get(this.catalog.jobs.staticAllocation, [this.type, jobId], 0));
	        }
	        return false;
	    }

	}

	module.exports = StaticJob;

/***/ },
/* 45 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(34);

	class ReserveJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'reserve', { flagPrefix: 'Reserve' }); }

	    // generate(){
	    //     var jobs = super.generate();
	    //     var downgradeFlags = this.catalog.getFlagsByPrefix('Downgrade');
	    //     if(downgradeFlags.length > 0){
	    //         _.forEach(downgradeFlags, flag =>{
	    //             if(flag.room && !flag.room.controller.owner){
	    //                 return;
	    //             }
	    //             var id = this.type+"-"+flag.name;
	    //             jobs[id] = {
	    //                 allocated: 0,
	    //                 capacity: 50,
	    //                 id,
	    //                 target: _.get(flag.room, 'controller', flag),
	    //                 downgrade: true
	    //             };
	    //         });
	    //     }
	    //     return jobs;
	    // }

	    generateJobsForFlag(flag){
	        var subtype = this.getSubflag(flag);
	        var job = {
	            allocated: 0,
	            capacity: 2,
	            id: this.type+"-"+flag.name,
	            target: _.get(flag.room, 'controller', flag)
	        };
	        if(subtype){
	            job[subtype] = true;
	            job.subtype = subtype;
	            job.id = this.type+"-"+subtype+"-"+flag.name;
	            if(subtype == 'downgrade'){
	                job.capacity = 50;
	            }
	        }
	        return [job];
	    }
	}

	module.exports = ReserveJob;

/***/ },
/* 46 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(34);

	class TransferJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'transfer'); }

	    generate(){
	        var energyStorage = _.filter(this.catalog.buildings.storage, storage => this.catalog.getResource(storage, RESOURCE_ENERGY) > 0);
	        var jobs = _.reduce(Memory.transfer.energy, (result, need, id)=>{
	            var target = Game.getObjectById(id);
	            if(!target){
	                return result;
	            }
	            var amount = need - this.catalog.getResource(target, RESOURCE_ENERGY);
	            var pickup = _.first(this.catalog.sortByDistance(target, energyStorage));
	            if(amount > 0 && pickup){
	                var job = this.createJob(target, pickup, amount, RESOURCE_ENERGY);
	                result[job.id] = job;
	            }
	            return result;
	        }, {});
	        
	        var storage = _.filter(this.catalog.buildings.storage, storage => this.catalog.getAvailableCapacity(storage) > 0);
	        jobs = _.reduce(Memory.transfer.lab, (result, resource, id)=>{
	            var target = Game.getObjectById(id);
	            if(!target){
	                return result;
	            }
	            if(resource === 'store'){
	                if(target.mineralAmount > Memory.settings.transferStoreThreshold){
	                    var dropoff = _.first(this.catalog.sortByDistance(target, storage));
	                    var job = this.createJob(dropoff, target, target.mineralAmount, target.mineralType);
	                    result[job.id] = job;
	                }
	            }else if(target.mineralAmount > 0 && resource != target.mineralType){
	                var dropoff = _.first(this.catalog.sortByDistance(target, storage));
	                var job = this.createJob(dropoff, target, target.mineralAmount, target.mineralType);
	                result[job.id] = job;
	            }else if(resource){
	                var amount = this.catalog.getCapacity(target) - this.catalog.getResource(target, resource);
	                if(amount >= Memory.settings.transferRefillThreshold){
	                    var sources = this.catalog.getStorageContainers(resource);
	                    var pickup = _.first(_.sortBy(sources, source => -this.catalog.getResource(source, resource)));
	                    var job = this.createJob(target, pickup, amount, resource);
	                    result[job.id] = job;
	                }
	            }
	            return result;
	        }, jobs);

	        jobs = _.reduce(this.catalog.buildings.terminal, (result, terminal)=>{
	            _.forEach(this.catalog.getResourceList(terminal), (amount, type)=>{
	                if(amount > Memory.settings.terminalMaxResources){
	                    var dropoff = _.first(this.catalog.sortByDistance(terminal, storage));
	                    var job = this.createJob(dropoff, terminal, amount - Memory.settings.terminalMaxResources, type);
	                    result[job.id] = job;
	                }
	            });
	            return result;
	        }, jobs);

	        return this.postGenerate(jobs);
	    }

	    finalizeJob(room, target, job){
	        return job;
	    }

	    createJob(target, pickup, amount, resource){
	        return {
	            allocated: 0,
	            amount,
	            capacity: amount,
	            id: this.generateId(target)+'-'+resource,
	            target,
	            pickup,
	            resource
	        };
	    }

	}

	module.exports = TransferJob;

/***/ },
/* 47 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(34);

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
/* 48 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(34);

	class HealJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'heal'); }

	    generate(){
	        var hurtCreeps = _.filter(Game.creeps, creep => creep.hits < creep.hitsMax && !creep.memory.ignoreHealth);
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
/* 49 */
/***/ function(module, exports) {

	"use strict";

	class QuotaManager {
	    constructor(catalog){
	        this.catalog = catalog;
	        this.quota = {};
	    }

	    process(){
	        this.quota = _.cloneDeep(this.catalog.jobs.capacity);
	        // _.forEach(this.catalog.jobs.capacity, (capacity, type)=>{
	        //     this.quota[type] = capacity;
	        // });

	        this.quota.spawnhauler = this.catalog.rooms.length * 2;
	        this.quota.levelerhauler = this.catalog.rooms.length * 2;
	        if(Memory.stats.global.maxSpawn < 1200){
	            this.quota.hauler = this.catalog.rooms.length * 4;
	        }
	        this.quota.repair = Math.ceil(Memory.stats.global.repair / 10000);

	        this.catalog.profile('pickup-remote', this.quota['pickup-remote']);

	        
	        // console.log(this.quota.repair, Memory.stats.global.repair);
	    }

	    add(type, value){
	        this.quota[type] = _.get(this.quota, type, 0) + value;
	    }

	    set(type, value){
	        this.quota[type] = value;
	    }

	    get(type){
	        return _.get(this.quota, type, 0);
	    }
	}

	module.exports = QuotaManager;

/***/ },
/* 50 */
/***/ function(module, exports) {

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

/***/ },
/* 51 */
/***/ function(module, exports) {

	"use strict";

	class Production {
	    constructor(catalog){
	        this.catalog = catalog;
	    }

	//production{
	//     labs: [[3 labs]],
	//     quota: {resource: count}
	// }
	// react{
	//     type: {
	//          lab: labNum,
	//          deficit,
	//          components,
	//      }
	// }
	    process(){
	        if(Game.time < (Memory.productionTime || 0)){
	            return;
	        }
	        Memory.productionTime = Game.time + 25;
	        var needs = _.pick(Memory.production.quota, (amount, type) => amount > this.catalog.getTotalStored(type));
	        var reactions = {};
	        _.forEach(needs, (amount, type) => {
	            this.generateReactions(type, amount - this.catalog.getTotalStored(type), reactions);
	        });
	        _.forEach(Memory.react, (data, type)=>{
	            if(!reactions[type]){
	                var labs = Memory.production.labs[data.lab];
	                _.forEach(labs, (lab) => {
	                    Memory.transfer.lab[lab] = false;
	                });
	                delete Memory.react[type];
	            }
	        });
	        _.forEach(reactions, (reaction, type) => {
	            if(Memory.react[type]){
	                Memory.react[type].deficit = reaction.deficit;
	            }else if(_.size(Memory.react) < _.size(Memory.production.labs)){
	                var labNum = this.findFreeLab();
	                if(labNum < 0){
	                    console.log('lab react mismatch!');
	                    return;
	                }
	                Memory.react[type] = {
	                    lab: labNum,
	                    deficit: reaction.deficit,
	                    components: reaction.components
	                };
	                var labs = Memory.production.labs[labNum];
	                _.forEach(reaction.components, (component, ix) => Memory.transfer.lab[labs[ix]] = component);
	                Memory.transfer.lab[labs[2]] = 'store';
	            }
	        });
	    }

	    findFreeLab(){
	        return _.findIndex(Memory.production.labs, (labList, ix) => !_.any(Memory.react, (data) => data.lab == ix));
	    }

	    generateReactions(type, deficit, output){
	        if(type.length == 1){
	            console.log('missing base component', type, deficit);
	            return;
	        }
	        var components = this.findReaction(type);
	        var inventory = _.map(components, component => this.catalog.getTotalStored(component) + this.catalog.getTotalLabResources(component));
	        var canReact = _.every(inventory, (amount, ix) => {
	            if(deficit - amount > 0){
	                //generate child reactions
	                this.generateReactions(components[ix], deficit - amount + Memory.settings.productionOverhead, output);
	            }
	            return amount > 0;
	        });

	        if(canReact){
	            if(output[type]){
	                output[type].deficit += deficit;
	            }else{
	                output[type] = { components, deficit };
	            }
	        }
	    }

	    findReaction(type){
	        var components = [];
	        var comp1 = _.findKey(REACTIONS, (reactionData, firstComp) => {
	            var comp2 = _.findKey(reactionData, (result, secondComp) => result === type);
	            if(comp2){
	                components.push(comp2);
	                return true;
	            }
	            return false;
	        });
	        if(comp1){
	            components.push(comp1);
	            return components;
	        }
	        console.log('invalid reaction', type);
	        return false;
	    }

	}

	module.exports = Production;

/***/ }
/******/ ]);