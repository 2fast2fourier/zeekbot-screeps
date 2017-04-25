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

	var Poly = __webpack_require__(1);
	var Startup = __webpack_require__(3);
	var Traveller = __webpack_require__(7);

	var Hegemony = __webpack_require__(8);
	var AutoBuilder = __webpack_require__(9);
	var Cluster = __webpack_require__(4);
	var Controller = __webpack_require__(10);
	var Spawner = __webpack_require__(6);
	var Worker = __webpack_require__(12);
	var Production = __webpack_require__(38);

	var REPAIR_CAP = 2000000;

	module.exports.loop = function () {
	    //// Startup ////
	    PathFinder.use(true);
	    Poly();
	    Game.hegemony = new Hegemony();
	    Startup.start();
	    
	    for(var name in Memory.creeps) {
	        if(!Game.creeps[name]) {
	            delete Memory.creeps[name];
	        }
	    }
	    Game.profile('memory', Game.cpu.getUsed());
	    Game.profileAdd('move', 0);
	    Game.profileAdd('movements', 0);
	    Cluster.init();
	    Startup.processActions();

	    let production = new Production();

	    let allocated = [];
	    

	    //// Process ////

	    let bootstrap = false;
	    if(Memory.bootstrap){
	        let target = Game.clusters[Memory.bootstrap];
	        bootstrap = target;
	    }

	    let initTime = Game.cpu.getUsed();

	    // let ix = 0;
	    // let autobuildOffset = _.size(Game.clusters) * 100;
	    for(let name in Game.clusters){
	        Game.longtermAdd('spawn-'+name, 0);
	        Game.longtermAdd('spawn-energy-'+name, 0);
	        let clusterStart = Game.cpu.getUsed();
	        let cluster = Game.clusters[name];
	        Worker.process(cluster);
	        
	        if(Game.interval(5)){
	            let spawnlist = Spawner.generateSpawnList(cluster, cluster);
	            if(!Spawner.processSpawnlist(cluster, spawnlist, cluster) && bootstrap && cluster.totalEnergy > 5000){
	                spawnlist = Spawner.generateSpawnList(cluster, bootstrap);
	                Spawner.processSpawnlist(cluster, spawnlist, bootstrap);
	            }
	        }

	        Controller.control(cluster, allocated);
	        production.process(cluster);
	        // let iy = 0;
	        // for(let buildRoom of cluster.roomflags.autobuild){
	        //     if(Game.intervalOffset(autobuildOffset, ix * 75 + iy)){
	        //         let builder = new AutoBuilder(buildRoom);
	        //         builder.buildTerrain();
	        //         let buildList = builder.generateBuildingList();
	        //         if(buildList){
	        //             builder.autobuild(buildList);
	        //         }
	        //     }
	        //     iy++;
	        // }
	        // if(Game.intervalOffset(autobuildOffset, ix * 20)){
	        //     AutoBuilder.buildInfrastructureRoads(cluster);
	        // }

	        if(Game.interval(100) && cluster.quota.repair < 750000 && cluster.totalEnergy > 500000 && cluster.opts.repair < REPAIR_CAP){
	            cluster.opts.repair += 25000;
	            Game.notify('Increasing repair target in ' + cluster.id + ' to ' + cluster.opts.repair);
	            console.log('Increasing repair target in ' + cluster.id + ' to ' + cluster.opts.repair);
	        }

	        Game.profile(name, Game.cpu.getUsed() - clusterStart);
	        // ix++;
	    }
	    
	    let clusterEndTime = Game.cpu.getUsed();

	    Controller.hegemony(allocated);

	    // if(Game.flags.autobuildDebug){
	    //     let buildRoom = Game.flags.autobuildDebug.room;
	    //     if(buildRoom){
	    //         let start = Game.cpu.getUsed();
	    //         let builder = new AutoBuilder(buildRoom);
	    //         builder.buildTerrain();
	    //         let structs = builder.generateBuildingList();
	    //         Game.profile('builder', Game.cpu.getUsed() - start);
	    //     }
	    // }
	    // AutoBuilder.processRoadFlags();

	    if(Game.interval(4899) && Game.cpu.bucket > 9000){
	        var line = _.first(_.keys(Memory.cache.path));
	        if(line){
	            console.log('Clearing pathing cache for room:', line);
	            delete Memory.cache.path[line];
	        }
	    }

	    if(Game.interval(50)){
	        for(var roomName in Memory.rooms){
	            if(_.size(Memory.rooms[roomName]) == 0){
	                delete Memory.rooms[roomName];
	            }
	        }
	    }
	    
	    //// Wrapup ////
	    Game.finishProfile();
	    Game.profile('cpu', Game.cpu.getUsed());

	    Game.profile('external', initTime + Game.cpu.getUsed() - clusterEndTime);
	    Game.profile('clusters', clusterEndTime - initTime);

	    if(Game.cpu.bucket < 5000){
	        Game.note('cpubucket', 'CPU bucket under limit!');
	    }
	    if(Game.cpu.bucket < 600){
	        Game.note('cpubucketcrit', 'CPU bucket critical!');
	    }
	}

/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	//contains polyfill-style helper injections to the base game classes.
	var roomRegex = /([WE])(\d+)([NS])(\d+)/;

	var profileData = {};
	var longProfileData = {};
	var profileStart = 0;

	const Pathing = __webpack_require__(2);

	const boostTypes = {};
	for(let partType in BOOSTS){
	    let resources = BOOSTS[partType];
	    for(let resource in resources){
	        if(resource.startsWith('X')){
	            for(let effect in resources[resource]){
	                boostTypes[effect] = resource;
	            }
	        }
	    }
	}

	module.exports = function(){
	    ///
	    /// Game Helpers
	    ///
	    Game.longterm = function(type, value){
	        if(!_.has(Memory.stats.longterm, type)){
	            Memory.stats.longterm[type] = value;
	            Memory.stats.longterm.count[type] = 1;
	        }else{
	            var count = Memory.stats.longterm.count[type];
	            Memory.stats.longterm[type] = (Memory.stats.longterm[type] * count + value)/(count + 1);
	            Memory.stats.longterm.count[type]++;
	        }
	    };

	    Game.profile = function(type, value){
	        if(!_.has(Memory.stats.profile, type)){
	            Memory.stats.profile[type] = value;
	            Memory.stats.profileCount[type] = 1;
	        }else{
	            var count = Memory.stats.profileCount[type];
	            Memory.stats.profile[type] = (Memory.stats.profile[type] * count + value)/(count + 1);
	            Memory.stats.profileCount[type]++;
	        }
	    };

	    Game.profileAdd = function(type, value){
	        _.set(profileData, type, _.get(profileData, type, 0) + value);
	    }

	    Game.longtermAdd = function(type, value){
	        _.set(longProfileData, type, _.get(longProfileData, type, 0) + value);
	    }

	    Game.perf = function(label){
	        var cpu = Game.cpu.getUsed();
	        if(label){
	            Game.profile(label, cpu - profileStart);
	        }
	        profileStart = cpu;
	    }

	    Game.perfAdd = function(label){
	        var cpu = Game.cpu.getUsed();
	        if(label){
	            Game.profileAdd(label, cpu - profileStart);
	        }
	        profileStart = cpu;
	    }

	    Game.finishProfile = function(){
	        _.forEach(profileData, (value, type) => Game.profile(type, value));
	        profileData = {};
	        _.forEach(longProfileData, (value, type) => Game.longterm(type, value));
	        longProfileData = {};
	    }

	    Game.interval = function interval(num){
	        return Game.time % num == 0;
	    };

	    Game.intervalOffset = function intervalOffset(num, offset){
	        return Game.time % num == offset;
	    };

	    Game.getObjects = function getObjects(idList){
	        return idList.map(entity => Game.getObjectById(entity));
	    };

	    Game.note = function note(type, message){
	        console.log(message);
	        if(_.get(Memory, ['notify', type], 0) < Game.time){
	            Game.notify(message);
	            _.set(Memory, ['notify', type], Game.time + 5000);
	        }
	    };

	    Game.owned = function owned(entity){
	        return entity.my || !entity.owner;
	    };

	    RoomObject.prototype.mine = function(){
	        return this.my || !this.owner;
	    }

	    Game.boosts = boostTypes;

	    /// Tag Helpers

	    Structure.prototype.hasTag = function(tag){
	        let cluster = this.room.getCluster();
	        if(cluster && cluster.tags[tag]){
	            return cluster.tags[tag].includes(this.id);
	        }
	        return false;
	    }

	    Structure.prototype.addTag = function(tag){
	        let cluster = this.room.getCluster();
	        if(cluster){
	            cluster.addTag(tag, this.id);
	        }
	    }

	    ///
	    /// Resource Helpers
	    ///

	    RoomObject.prototype.getResource = function(type){
	        return 0;
	    }

	    RoomObject.prototype.getResourceList = function(){
	        return {};
	    }

	    RoomObject.prototype.getAvailableCapacity = function(){
	        return this.getCapacity() - this.getStored();
	    }

	    //TODO override specific implementations to simplify getCapacity && getStored
	    RoomObject.prototype.getCapacity = function(){
	        if(this.carryCapacity > 0){
	            return this.carryCapacity;
	        }else if(this.storeCapacity > 0){
	            return this.storeCapacity;
	        }else if(this.mineralCapacity > 0){
	            return this.mineralCapacity;
	        }else if(this.energyCapacity > 0){
	            return this.energyCapacity;
	        }else if(this.resourceType && this.amount > 0){
	            return this.amount;
	        }
	        return 0;
	    }

	    RoomObject.prototype.getStored = function(){
	        if(this.carryCapacity > 0){
	            return _.sum(this.carry);
	        }else if(this.storeCapacity > 0){
	            return _.sum(this.store);
	        }else if(this.mineralCapacity > 0){
	            return this.mineralAmount;
	        }else if(this.energyCapacity > 0){
	            return this.energy;
	        }else if(this.resourceType && this.amount > 0){
	            return this.amount;
	        }
	        return 0;
	    }
	    //TODO add overrides for nuker and lab to allow type in getStored + getCapacity

	    Creep.prototype.getResource = function(type){
	        return _.get(this.carry, type, 0);
	    }

	    Creep.prototype.getResourceList = function(type){
	        return _.pick(this.carry, amount => amount > 0);
	    }

	    Structure.prototype.getResource = function(type){
	        if(this.storeCapacity > 0){
	            return _.get(this.store, type, 0);
	        }else if(this.mineralCapacity > 0 && type === this.mineralType){
	            return this.mineralAmount;
	        }else if(this.energyCapacity > 0 && type === RESOURCE_ENERGY){
	            return this.energy;
	        }else if(this.ghodiumCapacity > 0 && type === RESOURCE_GHODIUM){
	            return this.ghodium;
	        }
	        return 0;
	    }

	    Structure.prototype.getResourceList = function(){
	        if(this.storeCapacity > 0){
	            return _.pick(this.store, amount => amount > 0);
	        }
	        var result = {};
	        if(this.mineralCapacity > 0 && this.mineralAmount > 0){
	            result[this.mineralType] = this.mineralAmount;
	        }
	        if(this.energyCapacity > 0 && this.energy > 0){
	            result[RESOURCE_ENERGY] = this.energy;
	        }
	        if(this.resourceType && this.amount > 0){
	            result[this.resourceType] = this.amount;
	        }
	        if(this.ghodiumCapacity > 0 && this.ghodium > 0){
	            result[RESOURCE_GHODIUM] = this.ghodium;
	        }
	        return result;
	    }

	    Resource.prototype.getResource = function(type){
	        if(this.resourceType == type && this.amount > 0){
	            return this.amount;
	        }
	        return 0;
	    }

	    Mineral.prototype.hasExtractor = function(){
	        if(this.room){
	            return _.some(this.pos.lookFor(LOOK_STRUCTURES), struct => struct.structureType == STRUCTURE_EXTRACTOR && Game.owned(struct));
	        }
	        return false;
	    }

	    ///
	    /// Room Helpers
	    ///

	    Room.prototype.lookForRadius = function lookForRadius(pos, type, radius){
	        return _.map(this.lookForAtArea(type, Math.max(0, pos.y - radius), Math.max(0, pos.x - radius), Math.min(49, pos.y + radius), Math.min(49, pos.x + radius), true), type);
	    };

	    Room.prototype.hasCluster = function(){
	        return this.memory.cluster && Game.clusters[this.memory.cluster];
	    }

	    Room.prototype.getCluster = function(){
	        return Game.clusters[this.memory.cluster];
	    }

	    if(!Room.prototype.hasOwnProperty('cluster')){
	        Object.defineProperty(Room.prototype, 'cluster', {
	            enumerable: false,
	            configurable: true,
	            get: function(){
	                return Game.clusters[this.memory.cluster];
	            }
	        });
	    }

	    Room.prototype.getStructuresByType = function(type){
	        return _.filter(this.find(FIND_STRUCTURES), struct => struct.structureType == type);
	    }

	    Room.prototype.getAvailableStructureCount = function(type){
	        let existing = _.size(this.getStructuresByType(type));
	        existing += _.size(_.filter(this.find(FIND_MY_CONSTRUCTION_SITES), site => site.structureType == type));
	        return Math.max(0, _.get(CONTROLLER_STRUCTURES, [type, _.get(this, 'controller.level', 0)], 0) - existing);
	    }

	    ///
	    /// Position Helpers
	    ///

	    function cacheMinDistance(roomA, roomB){
	        if(roomA.name == roomB.name){
	            _.set(Memory.cache.dist, roomA.name + '-' + roomB.name, 0);
	            return 0;
	        }
	        var roomRoute = Game.map.findRoute(roomA, roomB);
	        if(_.isNumber(roomRoute) || roomRoute.length < 1){
	            _.set(Memory.cache, ['dist', roomA.name + '-' + roomB.name], 999);
	            console.log('no route found:', roomA.name, roomB.name);
	            return 999;
	        }else{
	            var cost = 0;
	            var lastExit = -1;
	            _.forEach(roomRoute, step => {
	                if(lastExit < 0){
	                    lastExit = step.exit;
	                    return;
	                }
	                if((step.exit + 4) % 8 == lastExit){
	                    cost += 50;
	                }else{
	                    cost += 20;
	                }
	                lastExit = step.exit;
	            });
	            _.set(Memory.cache, ['dist', roomA.name + '-' + roomB.name], cost);
	        }
	        return cost;
	    }

	    function getMinDistance(roomA, roomB){
	        if(!roomA || !roomB){
	            return 0;
	        }
	        var dist = _.get(Memory.cache.dist, roomA.name + '-' + roomB.name, -1);
	        if(dist < 0){
	            dist = _.get(Memory.cache.dist, roomB.name + '-' + roomA.name, -1);
	            if(dist < 0){
	                dist = cacheMinDistance(roomA, roomB);
	            }
	        }
	        return dist;
	    }

	    function cacheRoomPos(pos){
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

	    RoomPosition.prototype.getWorldPosition = function getWorldPosition(){
	        if(!Memory.cache){
	            Memory.cache = { roompos: {} };
	        }
	        var roompos = Memory.cache.roompos[this.roomName];
	        if(!roompos){
	            roompos = cacheRoomPos(this);
	        }
	        return {
	            x: roompos.x + this.x,
	            y: roompos.y + this.y * -roompos.ySign
	        };
	    }

	    RoomObject.prototype.getPos = function(){
	        return this.pos;
	    }

	    RoomObject.prototype.inRangeToAll = function(entities, range){
	        return _.every(entities, entity => this.pos.getRangeTo(entity) <= range);
	    }

	    RoomPosition.prototype.getPos = function(){
	        return this;
	    }

	    RoomPosition.prototype.getLinearDistance = function getLinearDistance(entity){
	        var target = entity instanceof RoomPosition ? entity : entity.pos;
	        var posA = this.getWorldPosition();
	        var posB = target.getWorldPosition();
	        return Math.max(Math.abs(posA.x - posB.x), Math.abs(posA.y-posB.y));
	    };

	    RoomPosition.prototype.getPathDistance = function getPathDistance(entity){
	        var target = entity instanceof RoomPosition ? entity : entity.pos;
	        return Math.max(this.getLinearDistance(target), Pathing.getMinPathDistance(this, target));
	    }

	    Flag.getByPrefix = function getByPrefix(prefix){
	        return _.filter(Game.flags, flag => flag.name.startsWith(prefix));
	    }

	    Flag.prototype.getStructure = function(){
	        return _.first(_.filter(this.pos.lookFor(LOOK_STRUCTURES), struct => struct.structureType != STRUCTURE_ROAD && struct.structureType != STRUCTURE_RAMPART));
	    }

	    Structure.prototype.getMaxHits = function(){
	        return this.hitsMax;
	    }

	    StructureRampart.prototype.getMaxHits = function(){
	        return Math.min(this.hitsMax, _.get(this.room, 'cluster.opts.repair', 250000));
	    }

	    StructureWall.prototype.getMaxHits = function(){
	        return Math.min(this.hitsMax, _.get(this.room, 'cluster.opts.repair', 250000));
	    }

	    Structure.prototype.getDamage = function(){
	        return Math.max(0, this.getMaxHits() - this.hits);
	    }

	};

/***/ },
/* 2 */
/***/ function(module, exports) {

	"use strict";

	function route(roomName){
	    if(Memory.avoidRoom[roomName]){
	        return 10;
	    }
	}

	class Pathing {

	    static posToSec(pos){
	        let x = Math.floor(pos.x / 16.1);
	        let y = Math.floor(pos.y / 16.1);
	        return {
	            x,
	            y,
	            room: pos.roomName,
	            id: pos.roomName + '-'+x+'-'+y
	        }
	    }

	    static secToPos(sec){
	        return new RoomPosition(Math.ceil(sec.x * 16.1) + 8, Math.ceil(sec.y * 16.1) + 8, sec.room)
	    }

	    static getMinPathDistance(start, end){
	        if(start.roomName == end.roomName){
	            return 0;
	        }
	        let startSec = Pathing.posToSec(start);
	        let pathName = startSec.id;
	        let targetMem = Memory.cache.path[end.roomName];
	        if(!targetMem){
	            targetMem = {};
	            Memory.cache.path[end.roomName] = targetMem;
	        }
	        let distance = targetMem[pathName];
	        if(_.isUndefined(distance)){
	            let result = Pathing.generatePath(start, new RoomPosition(25, 25, end.roomName), { debug: true, range: 20 });
	            distance = _.size(result.path);
	            targetMem[pathName] = distance;
	        }
	        return distance;
	    }
	    
	    static generatePath(start, end, opts){
	        let weights = opts.weights || { plainCost: 2, swampCost: 10, roadCost: 1 };
	        let result = PathFinder.search(start, { pos: end, range: (opts.range || 1) }, {
	            plainCost: weights.plainCost,
	            swampCost: weights.swampCost,
	            roomCallback: function(roomName) {
	                let room = Game.rooms[roomName];
	                if (!room) return;
	                let costs = new PathFinder.CostMatrix();
	                for(let structure of room.find(FIND_STRUCTURES)){
	                    if (structure.structureType === STRUCTURE_ROAD) {
	                        costs.set(structure.pos.x, structure.pos.y, weights.roadCost);
	                    } else if (structure.structureType !== STRUCTURE_CONTAINER && 
	                              (structure.structureType !== STRUCTURE_RAMPART || !structure.my)) {
	                        costs.set(structure.pos.x, structure.pos.y, 0xff);
	                    }
	                }
	                for(let site of room.find(FIND_MY_CONSTRUCTION_SITES)){
	                    if (site.structureType === STRUCTURE_ROAD) {
	                        costs.set(site.pos.x, site.pos.y, weights.roadCost);
	                    } else if (site.structureType !== STRUCTURE_CONTAINER && 
	                              (site.structureType !== STRUCTURE_RAMPART)) {
	                        costs.set(site.pos.x, site.pos.y, 0xff);
	                    }
	                }
	                return costs;
	            }
	        });
	        if(opts && opts.debug){
	            let visuals = {};
	            for(let pos of result.path){
	                if(!visuals[pos.roomName]){
	                    visuals[pos.roomName] = new RoomVisual(pos.roomName);
	                }
	                visuals[pos.roomName].rect(pos.x - 0.25, pos.y - 0.25, 0.5, 0.5, { fill: '#2892D7' });
	            }
	        }
	        return result;
	    }

	    static moveCreep(creep, target, range, ignoreRoads){
	        var start = Game.cpu.getUsed();
	        if(range > 1 && (target.pos.x < 2 || target.pos.y < 2 || target.pos.x > 47 || target.pos.y > 47)){
	            range = 1;
	        }
	        var result = creep.travelTo(target, { allowSK: false, ignoreCreeps: false, range, ignoreRoads: ignoreRoads, routeCallback: route });
	        Game.profileAdd('move', Game.cpu.getUsed() - start);
	        if(result == OK){
	            Game.profileAdd('movements', 0.2);
	        }
	        return result;
	    }

	    static attackMove(creep, target, ignoreStructures){
	        return creep.travelTo(target, { allowSK: true, ignoreCreeps: false, allowHostile: true, routeCallback: route });
	    }
	}

	module.exports = Pathing;

/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	let VERSION = 3;
	let STAT_INTERVAL = 100;
	let LONGTERM_STAT_INTERVAL = 5000;

	const Cluster = __webpack_require__(4);
	const creeps = __webpack_require__(5);
	const Spawner = __webpack_require__(6);

	class Startup {
	    static start(){
	        var ver = _.get(Memory, 'ver', 0);
	        if(ver < VERSION){
	            Startup.migrate(ver);
	        }

	        if(Game.interval(STAT_INTERVAL)){
	            Startup.longStats();
	            Startup.shortStats();
	        }
	        if(Game.interval(LONGTERM_STAT_INTERVAL)){
	            var msg = 'Statistics: \n';
	            _.forEach(Memory.stats.longterm, (value, type)=>{
	                if(type != 'count'){
	                    msg += type + ': ' + value + '\n';
	                    console.log('LT', type+':', value);
	                }
	            });
	            Memory.stats.longterm = {
	                count: {}
	            }
	            Game.notify(msg);
	        }
	    }

	    static convert(){
	        _.forEach(Game.rooms, (room, roomName)=>{
	            let clusterName = _.get(room, 'memory.cluster', 'Main');
	            if(!Memory.clusters[clusterName]){
	                Cluster.createCluster(clusterName);
	            }
	            let role = 'harvest';
	            if(room.controller && room.controller.my){
	                role = 'core';
	            }else if(!room.controller){
	                role = 'keep';
	            }
	            Cluster.addRoom(clusterName, roomName, _.get(room, 'memory.role', role), false);
	            for(let creep of room.find(FIND_MY_CREEPS)){
	                creep.memory.cluster = clusterName;
	            }
	        });
	        var translateTypes = {
	            levelerhauler: 'spawnhauler',
	            longhauler: 'harvesthauler',
	            picoclaimer: 'reserver',
	            picohealer: 'healer',
	            meleefighter: 'keeper',
	            rangedfighter: 'defender',
	            picoobserver: 'observer'
	        };
	        _.forEach(Game.creeps, creep=>{
	            var newType = _.get(translateTypes, creep.memory.type, creep.memory.type);
	            if(!creeps[newType]){
	                console.log('Cannot translate creep type:', creep.memory.type, newType);
	                creep.suicide();
	                return;
	            }
	            let data = creeps[newType];
	            _.assign(creep.memory, {
	                type: newType,
	                job: false,
	                jobType: false,
	                jobSubType: false,
	                jobAllocation: 0,
	                quota: data.quota,
	                quotaAlloc: Spawner.getAllocation(data, _.first(_.keys(data.parts)))
	            });
	        });
	        delete Memory.transfer;
	        delete Memory.production;
	        delete Memory.jobs;
	        delete Memory.settings;
	        delete Memory.linkTransfer;
	        delete Memory.resetBehavior;
	        delete Memory.standDown;
	        delete Memory.upgradedLogic;
	        delete Memory.productionTime;
	        delete Memory.accessibility;
	        delete Memory.debugMisc;
	        delete Memory.debugType;
	        delete Memory.boost;
	        delete Memory.stockpile;
	        delete Memory.scaling;
	        delete Memory.limits;
	        delete Memory.notify;
	        delete Memory.reaction;
	        delete Memory.watch;
	        delete Memory.roomlist;
	        delete Memory.keeps;
	    }
	    
	        // var memory = {
	        //     type,
	        //     version,
	        //     cluster: cluster.id,
	        //     job: false,
	        //     jobType: false,
	        //     jobSubType: false,
	        //     jobAllocation: 0,
	        //     quota: config.quota,
	        //     quotaAlloc: Spawner.getAllocation(config, version)
	        // };

	    static migrate(ver){
	        console.log('Migrating from version', ver, 'to', VERSION);
	        switch(ver){
	            case 0:
	                if(!Memory.uid){
	                    Memory.uid = 1;
	                }
	                Memory.stats = { profile: {}, profileCount: {}};
	                Memory.cache = {
	                    roompos: {},
	                    path: {}
	                };
	                Memory.clusters = {};
	                Memory.avoidRoom = {};
	                if(Memory.memoryVersion){
	                    console.log('Converting last-gen memory!');
	                    // let oldMem;
	                    try{
	                        // oldMem = JSON.stringify(Memory);
	                        Startup.convert();
	                    }catch(e){
	                        console.log(e);
	                        // console.log('ERROR Converting last-gen memory! REVERTING MEMORY');
	                        // Memory = JSON.parse(oldMem);
	                        return;
	                    }
	                    delete Memory.memoryVersion;
	                }
	            case 1:
	                _.forEach(Memory.clusters, cluster => {
	                    cluster.opts = {
	                        repair: 500000
	                    };
	                });
	            case 2:
	                _.forEach(Memory.clusters, cluster => {
	                    delete cluster.observe;
	                    cluster.stats = {};
	                    cluster.stats.count = {};
	                });
	                Memory.stats.longterm = {};
	                Memory.stats.longterm.count = {};
	            case 3:
	            //TODO add migration
	            // case 4:
	            //TODO add migration



	            //NOTE: keep break at bottom, intentionally fall through until here.
	                break;
	            default:
	                console.log('Nothing to do here!', ver, 'to', VERSION);
	                break;
	        }
	        Memory.ver = VERSION;
	        Game.notify('Successfully migrated from version '+ver+' to '+VERSION);
	    }

	    static shortStats(){
	        _.forEach(Memory.stats.profile, (value, type)=>console.log(type+':', value));
	        if(Game.cpu.bucket < 9500){
	            console.log('bucket:', Game.cpu.bucket);
	        }
	        var longterm = Memory.stats.longterm;
	        Memory.stats.longterm = null;
	        Memory.stats = {
	            longterm,
	            profile: {},
	            profileCount: {},
	            minerals: _.pick(_.mapValues(Game.hegemony.resources, 'total'), (amount, type) => type.length == 1 || type.length >= 5)
	        }
	    }

	    static longStats(){
	        _.forEach(Memory.stats.profile, (value, type)=>Game.longterm(type, value));
	    }

	    static processActions(){
	        let flags = Flag.getByPrefix('cluster');
	        for(let flag of flags){
	            let roomName = flag.pos.roomName;
	            let parts = flag.name.split('-');
	            let action = parts[1];
	            let target = parts[2];
	            let room = Game.rooms[roomName];

	            switch(action){
	                case 'new':
	                    if(!parts[2]){
	                        console.log('Missing cluster name!');
	                    }else if(!Game.clusters[target]){
	                        Cluster.createCluster(target);
	                        console.log('Created cluster:', target);
	                    }
	                    break;
	                case 'assign':
	                //cluster-assign-Home-harvest
	                    let cluster = Game.clusters[target];
	                    if(!cluster){
	                        console.log('Invalid cluster name!', target);
	                    }else if(_.get(Memory, ['rooms', roomName, 'cluster'], false) != target){
	                        if(_.get(Memory, ['rooms', roomName, 'cluster'], false) == target){
	                            break;
	                        }
	                        let role = parts.length > 3 ? parts[3] : 'harvest';
	                        Cluster.addRoom(cluster.id, roomName, role, true);
	                        console.log('Added', roomName, 'to cluster', cluster.id, 'role:', role);
	                    }
	                    break;
	                case 'reassign':
	                    if(!target){
	                        console.log('Missing cluster name!');
	                    }else{
	                        if(_.get(Memory, ['rooms', roomName, 'cluster'], false) == target){
	                            break;
	                        }
	                        Cluster.addRoom(target, roomName, parts[3], _.get(room, 'memory.autobuild', true));
	                        if(room){
	                            _.forEach(room.find(FIND_MY_CREEPS), creep => {
	                                creep.memory.cluster = target;
	                            });
	                        }
	                        console.log('Reassigned room to cluster:', target, roomName, parts[3]);
	                    }
	                    break;
	                case 'unassign':
	                    console.log('Removed room', roomName, 'from cluster.');
	                    delete Memory.rooms[roomName];
	                    break;
	                case 'role':
	                    if(!target){
	                        console.log('Missing role name!');
	                    }else{
	                        console.log('Changing role for room:', roomName, 'to', target);
	                        Cluster.setRole(roomName, target, true);
	                    }
	                    break;
	                default:
	                    console.log('Unknown action:', parts[1]);
	                    break;
	            }
	            flag.remove();
	        }
	    }
	}

	module.exports = Startup;

/***/ },
/* 4 */
/***/ function(module, exports) {

	"use strict";

	function catalogGlobal(resources, struct){
	    if(struct.structureType == STRUCTURE_STORAGE || struct.structureType == STRUCTURE_TERMINAL){
	        var stored = struct.getResourceList();
	        for(let type in stored){
	            let amount = stored[type];
	            resources[type].global += amount;
	            resources[type].globals[struct.structureType] += amount;
	        }
	    }
	}

	function catalogStorage(storage, resources){
	    var stored = storage.getResourceList();
	    for(let type in stored){
	        let amount = stored[type];
	        resources[type].total += amount;
	        resources[type].totals[storage.structureType] += amount;
	        resources[type][storage.structureType].push(storage);
	        if(storage.structureType != STRUCTURE_LAB
	           && (type != RESOURCE_ENERGY || storage.structureType == STRUCTURE_STORAGE)){
	            resources[type].stored += amount;
	            resources[type].sources.push(storage);
	        }
	    }
	}

	class Cluster {
	    constructor(id, data, creeps, rooms){
	        Object.assign(this, data);
	        this.id = id;
	        this.rooms = rooms;
	        this.creeps = creeps;

	        this.maxSpawn = 0;
	        this.maxRCL = 0;

	        this.structures = {
	            spawn: [],
	            extension: [],
	            rampart: [],
	            controller: [],
	            link: [],
	            storage: [],
	            tower: [],
	            observer: [],
	            powerBank: [],
	            powerSpawn: [],
	            extractor: [],
	            lab: [],
	            terminal: [],
	            nuker: []
	        };

	        this._found = {};
	        this._foundAll = {};
	        this._roleRooms = {
	            core: [],
	            harvest: [],
	            keep: [],
	            reserve: []
	        };

	        this.roomflags = {
	            defend: [],
	            reserve: [],
	            observe: [],
	            claim: [],
	            autobuild: [],
	            keep: [],
	            harvest: []
	        }

	        _.forEach(this.rooms, room => {
	            this._roleRooms[room.memory.role].push(room);
	            if(room.energyCapacityAvailable > this.maxSpawn){
	                this.maxSpawn = room.energyCapacityAvailable;
	            }
	            this.maxRCL = Math.max(this.maxRCL, _.get(room, 'controller.level', 0));
	            for(let type in this.roomflags){
	                if(room.memory[type]){
	                    this.roomflags[type].push(room);
	                }
	            }
	        });
	        if(Game.interval(20)){
	            let energy = this.findAll(FIND_DROPPED_ENERGY);
	            let containers = _.filter(this.getAllStructures([STRUCTURE_CONTAINER, STRUCTURE_STORAGE, STRUCTURE_LINK]), struct => struct.getResource(RESOURCE_ENERGY) > 0);
	            this.update('totalEnergy', _.sum(_.map(energy, 'amount')) + _.sum(_.map(containers, struct => struct.getResource(RESOURCE_ENERGY))));
	        }
	    }

	    static init(){
	        Memory.bootstrap = false;
	        let creeps = _.groupBy(Game.creeps, 'memory.cluster');
	        let rooms = _.groupBy(Game.rooms, 'memory.cluster');
	        Game.clusters = _.reduce(Memory.clusters, (result, data, name)=>{
	            result[name] = new Cluster(name, data, creeps[name], rooms[name]);
	            return result;
	        }, {});
	        _.forEach(Game.structures, structure =>{
	            let cluster = structure.room.getCluster();
	            if(cluster){
	                cluster.structures[structure.structureType].push(structure);
	            }
	        });
	        // console.log(Game.hegemony.structures.storage.length);
	        Cluster.processClusterFlags();
	        _.forEach(Game.clusters, cluster => {
	            if(cluster.maxRCL < 2 || _.size(cluster.structures.spawn) == 0){
	                Memory.bootstrap = cluster.id;
	                cluster.bootstrap = true;
	            }
	            if(Game.interval(30)){
	                Cluster.cleanupTags(cluster);
	            }
	            if(Game.interval(2000)){
	                let roomLabs = _.mapValues(_.groupBy(cluster.structures.lab, 'pos.roomName'), (labs, roomName) => _.filter(labs, lab => !lab.hasTag('boost')));
	                let labs = _.pick(_.mapValues(roomLabs, (labs, roomName) => _.map(_.sortBy(labs, lab => (lab.inRangeToAll(labs, 2) ? 'a' : 'z') + lab.id), 'id')), labs => labs.length > 2);
	                cluster.update('labs', _.values(labs));
	            }
	        });
	    }

	    static cleanupTags(cluster){
	        for(let tag in cluster.tags){
	            let tagged = cluster.tags[tag].filter(id => !!Game.getObjectById(id));
	            if(tagged.length > 0){
	                cluster.tags[tag] = tagged;
	            }else{
	                delete cluster.tags[tag];
	            }
	        }
	    }

	    //stockpile-id
	    static processClusterFlags(){
	        if(Memory.tag){
	            console.log('Processing tag:', Memory.tag);
	            let parts = Memory.tag.split('-');
	            let tag = parts[0];
	            let target = Game.getObjectById(parts[1]);
	            if(target && target.room && target.room.hasCluster()){
	                console.log('Added tag:', tag, 'to', target);
	                target.room.getCluster().addTag(tag, target.id);
	            }else{
	                console.log('could not find tag target', target, parts[1]);
	            }
	            delete Memory.tag;
	        }
	        if(Memory.removetag){
	            let parts = Memory.removetag.split('-');
	            let tag = parts[0];
	            let target = Game.getObjectById(parts[1]);
	            if(target && target.room && target.room.hasCluster()){
	                console.log('Removed tag:', tag, 'from', target);
	                target.room.getCluster().removeTag(tag, target.id);
	            }else{
	                console.log('could not find tag target', target, parts[1]);
	            }
	            delete Memory.removetag;
	        }
	        for(let flag of Flag.getByPrefix('tag')){
	            console.log('Processing tag:', flag.name);
	            let parts = flag.name.split('-');
	            let tag = parts[1];
	            let target = Cluster.getFlagTarget(flag);
	            if(target && target.room && target.room.hasCluster()){
	                console.log('Added tag:', tag, 'to', target);
	                target.room.getCluster().addTag(tag, target.id);
	            }else{
	                console.log('could not find tag target', target, flag.pos);
	            }
	            flag.remove();
	        }
	        for(let flag of Flag.getByPrefix('boost')){
	            let parts = flag.name.split('-');
	            let type = parts[1];
	            let target = Cluster.getFlagTarget(flag);
	            if(target && target.room.hasCluster() && Game.boosts[type]){
	                let cluster = target.room.getCluster();
	                cluster.boost[target.id] = type;
	                if(target.hasTag('production')){
	                    cluster.removeTag('production', target.id);
	                }
	                console.log("Setting", target, "to boost", type, '-', Game.boosts[type]);
	            }
	            flag.remove();
	        }
	    }

	    static getFlagTarget(flag){
	        return _.first(_.filter(flag.pos.lookFor(LOOK_STRUCTURES), struct => struct.structureType != STRUCTURE_ROAD && struct.structureType != STRUCTURE_RAMPART));
	    }

	    static createCluster(id){
	        //tags: stockpile, input, output, boost
	        let data = {
	            assignments: {},
	            labs: [],
	            quota: {},
	            reaction: {},
	            tags: {},
	            transfer: {},
	            work: {},
	            totalEnergy: 0,
	            opts: {
	                repair: 250000
	            },
	            boost: {},
	            stats: {}
	        };
	        _.set(Memory, ['clusters', id], data);
	        if(Game.clusters){
	            Game.clusters[id] = new Cluster(id, data, [], [], Game.hegemony);
	        }
	    }

	    static addRoom(clusterId, roomName, role, autobuild){
	        _.set(Memory, ['rooms', roomName, 'cluster'], clusterId);
	        Cluster.setRole(roomName, role, autobuild);
	        console.log('Added room', roomName, 'to', clusterId, role, autobuild ? 'with autobuild' : '');
	    }

	    static setRole(roomName, role, autobuild){
	        _.set(Memory, ['rooms', roomName, 'role'], role);
	        _.assign(Memory.rooms[roomName], {
	            defend: true,
	            observe: true,
	            reserve: role != 'keep',
	            autobuild: role != 'reserve' && autobuild,
	            keep: role == 'keep',
	            harvest: role != 'core' && role != 'reserve'
	        });
	        if(role == 'core'){
	            _.set(Memory, ['rooms', roomName, 'claim'], true);
	        }else if(_.has(Memory, ['rooms', roomName, 'claim'])){
	            delete Memory.rooms[roomName].claim;
	        }
	    }

	    changeRole(roomName, newRole){
	        Cluster.addRoom(this.id, roomName, newRole);
	    }

	    addTag(tag, id){
	        if(!this.tags[tag]){
	            this.tags[tag] = [];
	        }
	        if(!_.includes(this.tags[tag], id)){
	            this.tags[tag].push(id);
	        }
	    }

	    removeTag(tag, id){
	        if(this.tags[tag]){
	            this.tags[tag] = _.pull(this.tags[tag], id);
	        }
	    }

	    find(room, type){
	        if(!this._found[room.name]){
	            this._found[room.name] = {};
	        }
	        let result = _.get(this._found, [room.name, type], false);
	        if(!result){
	            result = room.find(type);
	            _.set(this._found, [room.name, type], result);
	        }
	        return result;
	    }

	    findIn(rooms, type){
	        return _.flatten(_.map(rooms, room => this.find(room, type)));
	    }

	    findAll(type){
	        let found = this._foundAll[type];
	        if(!found){
	            found = _.flatten(_.map(this.rooms, room => this.find(room, type)));
	            this._foundAll[type] = found;
	        }
	        return found;
	    }

	    getStructuresByType(room, type){
	        return _.filter(this.find(room, FIND_STRUCTURES), struct => struct.structureType == type);
	    }

	    getAllMyStructures(types){
	        return _.filter(this.findAll(FIND_MY_STRUCTURES), struct => _.includes(types, struct.structureType));
	    }

	    getAllStructures(types){
	        return _.filter(this.findAll(FIND_STRUCTURES), struct => _.includes(types, struct.structureType));
	    }

	    getTaggedStructures(){
	        if(!this._tagged){
	            this._tagged = _.mapValues(this.tags, (list, tag)=>_.compact(Game.getObjects(list)));
	        }
	        return this._tagged;
	    }

	    getRoomsByRole(role){
	        return this._roleRooms[role] || [];
	    }

	    update(type, value){
	        this[type] = value;
	        Memory.clusters[this.id][type] = value;
	    }

	    get resources(){
	        if(!this._resources){
	            this.initResources();
	        }
	        return this._resources;
	    }

	    initResources(){
	        this._resources = _.zipObject(RESOURCES_ALL, _.map(RESOURCES_ALL, resource => {
	            return {
	                total: 0,
	                global: 0,
	                stored: 0,
	                sources: [],
	                storage: [],
	                terminal: [],
	                lab: [],
	                totals: {
	                    storage: 0,
	                    terminal: 0,
	                    lab: 0
	                },
	                globals: {
	                    storage: 0,
	                    terminal: 0
	                }
	            };
	        }));

	        for(let storage of this.structures.storage){
	            catalogStorage(storage, this._resources);
	        }
	        for(let storage of this.structures.terminal){
	            catalogStorage(storage, this._resources);
	        }
	        for(let storage of this.structures.lab){
	            catalogStorage(storage, this._resources);
	        }
	        _.forEach(Game.structures, catalogGlobal.bind(this, this._resources));
	    }

	    getResources(){
	        return this.resources;
	    }

	    get boostMinerals(){
	        if(!this._boostMinerals){
	            this._boostMinerals = _.reduce(this.boost, (result, type, labId)=>{
	                var resource = Game.boosts[type];
	                var lab = Game.getObjectById(labId);
	                if(lab && lab.mineralType == resource){
	                    result[resource] = lab.mineralAmount;
	                }
	                return result;
	            }, {});
	        }
	        return this._boostMinerals;
	    }

	}

	module.exports = Cluster;

/***/ },
/* 5 */
/***/ function(module, exports) {

	"use strict";

	var haulerParts = {
	    mega: { carry: 32, move: 16 },//2400
	    kilo: { carry: 24, move: 12 },//1500
	    milli: { carry: 16, move: 8 },//1200
	    micro: { carry: 8, move: 8 },//800
	    nano: { carry: 5, move: 5 },//550
	    pico: { carry: 3, move: 3 }//300
	};

	module.exports = {
	    defender: {
	        quota: 'defend',
	        critical: true,
	        parts: {
	            milli: { tough: 5, move: 25, ranged_attack: 20 },
	            micro: { tough: 5, move: 25, ranged_attack: 15 },
	            nano: { tough: 5, move: 10, ranged_attack: 5 },
	            pico: { tough: 5, move: 7, ranged_attack: 2 },
	            femto: { tough: 2, move: 4, ranged_attack: 2 }
	        },
	        work: { defend: {}, idle: { subtype: 'tower' } }//observe: { onlyReveal: true }, 
	    },
	    spawnhauler: {
	        quota: 'spawnhauler',
	        allocation: 'carry',
	        allocationMulti: 50,
	        critical: true,
	        assignRoom: 'spawn',
	        parts: haulerParts,
	        emergency: 'pico',
	        work: { 
	            pickup: { local: true },
	            deliver: { subtype: 'spawn', local: true },
	            idle: { subtype: 'spawn', local: true }
	        },
	        behavior: { avoid: {} }
	    },
	    energyminer: {
	        quota: 'energy-mine',
	        critical: true,
	        allocation: 'work',
	        allocationMax: 6,
	        parts: {
	            milli: { move: 4, carry: 2, work: 8 },//standard 1100
	            micro: { move: 3, carry: 1, work: 6 },//800
	            nano: { move: 2, carry: 2, work: 3 },//550
	            pico: { move: 1, carry: 1, work: 2 }//300
	        },
	        emergency: 'pico',
	        work: { mine: { subtype: 'energy' } },
	        behavior: { avoid: {}, minecart: {} }
	    },
	    stockpilehauler: {
	        quota: 'stockpile-deliver',
	        allocation: 'carry',
	        allocationMulti: 50,
	        parts: haulerParts,
	        work: { 
	            pickup: {},
	            deliver: { subtype: 'stockpile' }
	        },
	        behavior: { avoid: {} }
	    },
	    harvesthauler: {
	        quota: 'harvesthauler',
	        allocation: 'carry',
	        allocationMax: 24,
	        parts: haulerParts,
	        assignRoom: 'harvest',
	        work: {
	            pickup: { subtype: 'harvest' },
	            deliver: { subtype: 'storage' }
	        },
	        behavior: { avoid: {} }
	    },
	    reserver: {
	        quota: 'reserve',
	        allocation: 'claim',
	        allocationMax: 2,
	        parts: {
	            micro: { claim: 4, move: 4 },
	            nano: { claim: 2, move: 2 },
	            pico: { claim: 1, move: 1 }
	        },
	        work: { reserve: {} },
	        behavior: { avoid: {} }
	    },
	    keeper: {
	        quota: 'keep',
	        assignRoom: 'keep',
	        parts: {
	            milli: { move: 25, ranged_attack: 2, attack: 18, heal: 5 },
	            micro: { tough: 6, move: 25, attack: 15, heal: 4 },
	            nano: { tough: 14, move: 17, attack: 15, heal: 4 }
	            // pico: { tough: 15, move: 15, attack: 15 }//TODO enable RCL6 SK?
	        },
	        work: { keep: { local: true } },//, defend: {}//TODO defend tooo
	        behavior: { selfheal: {} }
	    },
	    builderworker: {
	        quota: 'build',
	        maxQuota: 20000,
	        allocation: 'work',
	        allocationMulti: 1000,
	        parts: {
	            kilo: { move: 17, carry: 12, work: 5 },//1700
	            milli: { move: 10, carry: 6, work: 4 },//1200
	            micro: { move: 7, carry: 5, work: 2 },//800
	            nano: { move: 4, carry: 2, work: 2 },//550
	            pico: { move: 2, carry: 1, work: 1 }//300
	        },
	        work: { pickup: {}, build: {}, repair: { priority: 99 }, idle: { subtype: 'controller' } },
	        behavior: { avoid: {} }
	    },
	    upgradeworker: {
	        quota: 'upgrade',
	        allocation: 'work',
	        parts: {
	            mega: { work: 15, move: 12, carry: 9 },//2550
	            kilo: { work: 15, move: 9, carry: 3 },//2100
	            milli: { work: 5, move: 6, carry: 6 },//1200
	            micro: { work: 5, move: 4, carry: 2 },//800
	            nano: { move: 3, carry: 4, work: 2 },//550
	            pico: { move: 2, carry: 1, work: 1 }//300
	        },
	        work: { pickup: {}, upgrade: {}, idle: { subtype: 'controller' } },
	        behavior: { energy: {}, avoid: {} }
	    },
	    repairworker: {
	        quota: 'repair',
	        allocation: 'work',
	        allocationMulti: 5000,
	        maxQuota: 300000,
	        parts: {
	            milli: { move: 6, carry: 7, work: 5 },//1150
	            micro: { move: 7, carry: 5, work: 2 },//800
	            nano: { move: 5, carry: 4, work: 1 },//550
	            pico: { move: 2, carry: 1, work: 1 }//300
	        },
	        work: { pickup: {}, repair: {}, idle: { subtype: 'controller' } },
	        behavior: { avoid: {}, repair: {} }
	    },
	    observer: {
	        quota: 'observe',
	        critical: true,
	        parts: { pico: { move: 1 } },
	        work: { observe: {} },
	        behavior: { avoid: {} }
	    },
	    healer: {
	        quota: 'heal',
	        maxQuota: 1,
	        parts: {
	            micro: { move: 4, heal: 4 },
	            nano: { move: 2, heal: 2 },
	            pico: { move: 1, heal: 1 }
	        },
	        work: { heal: {} }
	    },
	    mineralminer: {
	        quota: 'mineral-mine',
	        allocation: 'work',
	        allocationMax: 6,
	        parts: {
	            pico: { move: 6, carry: 4, work: 8 }
	        },
	        work: { mine: { subtype: 'mineral' } },
	        behavior: { avoid: {}, minecart: {} }
	    },
	    mineralhauler: {
	        quota: 'mineral-pickup',
	        allocation: 'carry',
	        allocationMulti: 50,
	        parts: { milli: { carry: 16, move: 8 } },
	        work: {
	            pickup: { subtype: 'mineral' },
	            deliver: { subtype: 'terminal' }
	        },
	        behavior: { avoid: {} }
	    },
	    transferhauler: {
	        quota: 'transfer',
	        maxQuota: 12,
	        allocation: 2,
	        parts: { milli: { carry: 20, move: 10 } },
	        work: {
	            transfer: {},
	            deliver: { subtype: 'terminal', priority: 99 },
	            idle: { subtype: 'terminal' }
	        },
	        behavior: { avoid: {} }
	    },
	    dismantler: {
	        quota: 'dismantle',
	        allocation: 'work',
	        allocationMulti: 75000,
	        maxQuota: 5000000,
	        parts: {
	            mega: { work: 25, move: 25 },
	            kilo: { work: 15, move: 15 },
	            milli: { work: 12, move: 12 },
	            micro: { work: 8, move: 8 },
	            nano: { work: 5, move: 5 },
	            pico: { work: 2, move: 2 }
	        },
	        work: { dismantle: {} },
	        behavior: { avoid: {} }
	    },
	    spawnhaulerfb: {
	        quota: 'spawnhauler',
	        allocation: 'carry',
	        allocationMulti: 100,
	        critical: true,
	        assignRoom: 'spawn',
	        parts: { pico: {carry: 4, move: 2 } },
	        work: {
	            pickup: { local: true },
	            deliver: { subtype: 'spawn', local: true },
	            idle: { subtype: 'spawn', local: true }
	        },
	        behavior: { avoid: {} }
	    },
	    attacker: {
	        quota: 'attack',
	        boost: {
	            milli: { fatigue: 10, damage: 10, attack: 10, heal: 20 }
	        },
	        parts: {
	            milli: { tough: 10, move: 10, attack: 10, heal: 20 },
	            micro: { tough: 5, move: 25, attack: 15, heal: 5 }
	        },
	        work: { attack: {} },
	        behavior: { selfheal: { block: 1 }, defend: {}, boost: {} }
	    }
	}

/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var creepsConfig = __webpack_require__(5);

	class Spawner {

	    static processSpawnlist(cluster, spawnlist, targetCluster){
	        if(spawnlist.totalCost == 0){
	            return;
	        }

	        let result = false;
	        if(_.size(spawnlist.critical) > 0){
	            result = _.find(spawnlist.critical, (count, type)=>Spawner.attemptSpawn(cluster, spawnlist, type, count, targetCluster));
	        }else{
	            result = _.find(spawnlist.count, (count, type)=>Spawner.attemptSpawn(cluster, spawnlist, type, count, targetCluster));
	        }
	        return !!result;
	    }

	    static attemptSpawn(cluster, spawnlist, type, count, targetCluster){
	        var spawned = false;
	        _.find(cluster.structures.spawn, spawn =>{
	            if(!spawned && Spawner.canSpawn(spawn, spawnlist.parts[type], spawnlist.costs[type])){
	                spawned = Spawner.spawnCreep(targetCluster, spawn, spawnlist, type);
	            }
	        });
	        return spawned;
	    }

	    static generateSpawnList(cluster, targetCluster){
	        var spawnlist = {
	            costs: {},
	            critical: {},
	            count: {},
	            parts: {},
	            version: {},
	            totalCost: 0
	        };
	        var allocation = Spawner.calculateQuotaAllocation(targetCluster);

	        _.forEach(creepsConfig, (config, type)=>{
	            let emergency = cluster.id == targetCluster.id && config.critical && config.emergency && _.get(allocation, config.quota, 0) == 0;
	            let maxCost = 0;
	            let version = false;
	            let partSet = false;
	            if(emergency){
	                let cost = Spawner.calculateCost(config.parts[config.emergency]);
	                maxCost = cost;
	                version = config.emergency;
	                partSet = config.parts[config.emergency];
	                // Game.notify('EMERGENCY! Spawning ' + version + ' - ' + type + ' in ' + targetCluster.id);
	            }else{
	                _.forEach(config.parts, (parts, ver) => {
	                    let cost = Spawner.calculateCost(parts);
	                    if(cost > maxCost && cost <= cluster.maxSpawn){
	                        maxCost = cost;
	                        version = ver;
	                        partSet = parts;
	                    }
	                });
	            }
	            if(version){
	                const limit = Spawner.calculateSpawnLimit(cluster, type, config, version);
	                const quota = Spawner.calculateRemainingQuota(targetCluster, type, config, allocation, version);
	                const need = Math.min(limit, quota);
	                if(need > 0){
	                    spawnlist.costs[type] = maxCost;
	                    spawnlist.parts[type] = Spawner.partList(partSet);
	                    spawnlist.version[type] = version;
	                    if(config.critical){
	                        spawnlist.critical[type] = need;
	                    }
	                    spawnlist.count[type] = need;
	                    spawnlist.totalCost += need * spawnlist.costs[type];
	                }
	            }
	        });

	        return spawnlist;
	    }

	    static calculateQuotaAllocation(targetCluster){
	        var allocation = {};
	        _.forEach(targetCluster.creeps, creep =>{
	            if(creep.spawning || !creep.ticksToLive || (creep.ticksToLive >= _.size(creep.body) * 3)){
	                var quota = creep.memory.quota;
	                _.set(allocation, quota, _.get(allocation, quota, 0) + creep.memory.quotaAlloc);
	            }
	        });

	        return allocation;
	    }

	    static getAllocation(config, version){
	        let alloc = _.get(config, 'allocation', 1);
	        if(_.isString(alloc)){
	            alloc = _.get(config, ['parts', version, alloc], 1);
	        }
	        alloc *= _.get(config, 'allocationMulti', 1);
	        return Math.min(alloc, _.get(config, 'allocationMax', Infinity));
	    }

	    static calculateRemainingQuota(targetCluster, type, config, allocation, version){
	        var perCreep = Spawner.getAllocation(config, version);
	        var quota = Math.min(_.get(targetCluster.quota, config.quota, 0), _.get(config, 'maxQuota', Infinity));
	        var allocated = _.get(allocation, config.quota, 0);
	        let unmetQuota = quota - allocated;
	        var creepsNeeded = Math.ceil(unmetQuota/perCreep);
	        return creepsNeeded;
	    }

	    static calculateSpawnLimit(cluster, type, config, version){
	        var limit = Infinity;
	        if(config.boost && config.boost[version]){
	            limit = _.min(_.map(config.boost[version], (amount, type) => Math.floor((_.get(cluster.boostMinerals, Game.boosts[type], 0) / 30) / amount)));
	        }
	        return limit;
	    }

	    static spawnCreep(cluster, spawn, spawnlist, spawnType){
	        var versionName = spawnlist.version[spawnType];
	        var config = creepsConfig[spawnType];
	        var mem = Spawner.prepareSpawnMemory(cluster, config, spawnType, versionName);
	        if(spawn.room.memory.cluster != cluster.id){
	            mem.bootstrap = true;
	        }
	        var spawned = spawn.createCreep(spawnlist.parts[spawnType], spawnType+'-'+Memory.uid, mem);
	        Memory.uid++;
	        if(spawned){
	            console.log(cluster.id, '-', spawn.name, 'spawning', spawned, spawnlist.costs[spawnType]);
	            Game.longtermAdd('spawn-'+cluster.id, _.size(spawnlist.parts[spawnType]) * 3);
	            Game.longtermAdd('spawn-energy-'+cluster.id, spawnlist.costs[spawnType]);
	        }else{
	            Game.notify('Could not spawn!', cluster.id, spawnType, spawn.name);
	        }
	        return spawned;
	    }

	    static canSpawn(spawn, parts, cost){
	        return spawn.room.energyAvailable >= cost && spawn.canCreateCreep(parts) == OK;
	    }

	    static prepareSpawnMemory(cluster, config, type, version){
	        var memory = {
	            type,
	            version,
	            cluster: cluster.id,
	            job: false,
	            jobType: false,
	            jobSubType: false,
	            jobAllocation: 0,
	            quota: config.quota,
	            quotaAlloc: Spawner.getAllocation(config, version)
	        };
	        
	        if(config.critical){
	            memory.critical = true;
	        }

	        if(config.boost && config.boost[version]){
	            memory.boost = _.clone(config.boost[version]);
	        }

	        if(config.assignRoom){
	            memory.room = Spawner.getRoomAssignment(cluster, type, config);
	            memory.roomtype = config.assignRoom;
	            console.log('Assigned', type, 'to room', memory.room, '-', memory.roomtype);
	        }

	        if(config.memory){
	            _.assign(memory, config.memory);
	        }

	        return memory;
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

	    static getRoomAssignment(cluster, spawnType, config){
	        let type = config.assignRoom;

	        let assignments = _.reduce(Game.creeps, (result, creep)=>{
	            if(creep.memory.room && creep.memory.roomtype == type){
	                _.set(result, creep.memory.room, _.get(result, creep.memory.room, 0) + (_.get(creep, 'ticksToLive', 1500) / 1500));
	            }
	            return result;
	        }, {});
	        
	        var least = Infinity;
	        var targetRoom = false;
	        _.forEach(cluster.assignments[type], (target, roomName) => {
	            var assigned = _.get(assignments, roomName, 0) / target;
	            if(assigned < least){
	                least = assigned;
	                targetRoom = roomName;
	            }
	        });
	        if(targetRoom){
	            return targetRoom;
	        }else{
	            Game.note('spawnAssignFailed', 'Failed to assign room '+type+' - '+spawnType+' - '+JSON.stringify(assignments));
	            return false;
	        }
	    }
	}


	module.exports = Spawner;

/***/ },
/* 7 */
/***/ function(module, exports) {

	"use strict";
	/**
	 * https://gist.github.com/bonzaiferroni/bbbbf8a681f071dc13759da8a1be316e
	 */
	// const REPORT_CPU_THRESHOLD = 50;
	const DEFAULT_MAXOPS = 40000;
	const DEFAULT_STUCK_VALUE = 3;
	class Traveler {
	    constructor() {}
	    findAllowedRooms(origin, destination, options = {}) {
	        _.defaults(options, { restrictDistance: 16 });
	        if (Game.map.getRoomLinearDistance(origin, destination) > options.restrictDistance) {
	            return;
	        }
	        let allowedRooms = { [origin]: true, [destination]: true };
	        let ret = Game.map.findRoute(origin, destination, {
	            routeCallback: (roomName) => {
	                if (options.routeCallback) {
	                    let outcome = options.routeCallback(roomName);
	                    if (outcome !== undefined) {
	                        return outcome;
	                    }
	                }
	                if (Game.map.getRoomLinearDistance(origin, roomName) > options.restrictDistance) {
	                    return false;
	                }
	                let parsed;
	                if (options.preferHighway) {
	                    parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
	                    let isHighway = (parsed[1] % 10 === 0) || (parsed[2] % 10 === 0);
	                    if (isHighway) {
	                        return 1;
	                    }
	                }
	                if (!options.allowSK && !Game.rooms[roomName]) {
	                    if (!parsed) {
	                        parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
	                    }
	                    let fMod = parsed[1] % 10;
	                    let sMod = parsed[2] % 10;
	                    let isSK = !(fMod === 5 && sMod === 5) &&
	                        ((fMod >= 4) && (fMod <= 6)) &&
	                        ((sMod >= 4) && (sMod <= 6));
	                    if (isSK) {
	                        return 10;
	                    }
	                }
	                if (!options.allowHostile && Memory.avoidRoom[roomName] &&
	                    roomName !== destination && roomName !== origin) {
	                    return Number.POSITIVE_INFINITY;
	                }
	                return 2.5;
	            },
	        });
	        if (!_.isArray(ret)) {
	            console.log(`couldn't findRoute to ${destination}`);
	            return;
	        }
	        for (let value of ret) {
	            allowedRooms[value.room] = true;
	        }
	        return allowedRooms;
	    }
	    findTravelPath(origin, destination, options = {}) {
	        _.defaults(options, {
	            ignoreCreeps: true,
	            range: 1,
	            maxOps: DEFAULT_MAXOPS,
	            obstacles: [],
	        });
	        let allowedRooms;
	        if (options.useFindRoute || (options.useFindRoute === undefined &&
	            Game.map.getRoomLinearDistance(origin.pos.roomName, destination.pos.roomName) > 2)) {
	            allowedRooms = this.findAllowedRooms(origin.pos.roomName, destination.pos.roomName, options);
	        }
	        let callback = (roomName) => {
	            if (options.roomCallback) {
	                let outcome = options.roomCallback(roomName, options.ignoreCreeps);
	                if (outcome !== undefined) {
	                    return outcome;
	                }
	            }
	            if (allowedRooms) {
	                if (!allowedRooms[roomName]) {
	                    return false;
	                }
	            }
	            else if (Memory.avoidRoom[roomName] && !options.allowHostile) {
	                return false;
	            }
	            let room = Game.rooms[roomName];
	            if (!room) {
	                return;
	            }
	            let matrix;
	            if (options.ignoreStructures) {
	                matrix = new PathFinder.CostMatrix();
	                if (!options.ignoreCreeps) {
	                    Traveler.addCreepsToMatrix(room, matrix);
	                }
	            }
	            else if (options.ignoreCreeps || roomName !== origin.pos.roomName) {
	                matrix = this.getStructureMatrix(room);
	            }
	            else {
	                matrix = this.getCreepMatrix(room);
	            }
	            for (let obstacle of options.obstacles) {
	                matrix.set(obstacle.pos.x, obstacle.pos.y, 0xff);
	            }
	            return matrix;
	        };
	        return PathFinder.search(origin.pos, { pos: destination.pos, range: options.range }, {
	            maxOps: options.maxOps,
	            plainCost: options.ignoreRoads ? 1 : 2,
	            roomCallback: callback,
	            swampCost: options.ignoreRoads ? 5 : 10,
	        });
	    }
	    travelTo(creep, destination, options = {}) {
	        // initialize data object
	        if (!creep.memory._travel) {
	            creep.memory._travel = { stuck: 0, tick: Game.time, count: 0 };//cpu
	        }
	        let travelData = creep.memory._travel;
	        if (creep.fatigue > 0) {
	            travelData.tick = Game.time;
	            return ERR_BUSY;
	        }
	        if (!destination) {
	            return ERR_INVALID_ARGS;
	        }
	        // manage case where creep is nearby destination
	        let rangeToDestination = creep.pos.getRangeTo(destination);
	        if (rangeToDestination <= 1) {
	            if (rangeToDestination === 1 && !(options.range >= 1)) {
	                if (options.returnData) {
	                    options.returnData.nextPos = destination.pos;
	                }
	                return creep.move(creep.pos.getDirectionTo(destination));
	            }
	            return OK;
	        }
	        // check if creep is stuck
	        let hasMoved = true;
	        if (travelData.prev) {
	            travelData.prev = Traveler.initPosition(travelData.prev);
	            if (creep.pos.inRangeTo(travelData.prev, 0)) {
	                hasMoved = false;
	                travelData.stuck++;
	            }
	            else {
	                travelData.stuck = 0;
	            }
	        }
	        // handle case where creep is stuck
	        if (travelData.stuck >= DEFAULT_STUCK_VALUE && !options.ignoreStuck) {
	            options.ignoreCreeps = false;
	            delete travelData.path;
	        }
	        // handle case where creep wasn't traveling last tick and may have moved, but destination is still the same
	        if (Game.time - travelData.tick > 1 && hasMoved) {
	            delete travelData.path;
	        }
	        travelData.tick = Game.time;
	        // delete path cache if destination is different
	        if (!travelData.dest || travelData.dest.x !== destination.pos.x || travelData.dest.y !== destination.pos.y ||
	            travelData.dest.roomName !== destination.pos.roomName) {
	            delete travelData.path;
	        }
	        // pathfinding
	        if (!travelData.path) {
	            if (creep.spawning) {
	                return ERR_BUSY;
	            }
	            travelData.dest = destination.pos;
	            travelData.prev = undefined;
	            let ret = this.findTravelPath(creep, destination, options);
	            travelData.count++;
	            if (ret.incomplete) {
	                // console.log(`TRAVELER: incomplete path for ${creep.name}`);
	                if (ret.ops < 2000 && options.useFindRoute === undefined && travelData.stuck < DEFAULT_STUCK_VALUE) {
	                    options.useFindRoute = false;
	                    ret = this.findTravelPath(creep, destination, options);
	                    console.log(`attempting path without findRoute was ${ret.incomplete ? "not" : ""} successful`);
	                }
	            }
	            travelData.end = _.last(ret.path);
	            travelData.path = Traveler.serializePath(creep.pos, ret.path);
	            travelData.stuck = 0;
	        }
	        if (!travelData.path || travelData.path.length === 0) {
	            return ERR_NO_PATH;
	        }
	        // consume path and move
	        if (travelData.prev && travelData.stuck === 0) {
	            travelData.path = travelData.path.substr(1);
	        }
	        travelData.prev = creep.pos;
	        let nextDirection = parseInt(travelData.path[0], 10);
	        if (options.returnData) {
	            options.returnData.nextPos = Traveler.positionAtDirection(creep.pos, nextDirection);
	        }
	        return creep.move(nextDirection);
	    }
	    getStructureMatrix(room) {
	        this.refreshMatrices();
	        if (!this.structureMatrixCache[room.name]) {
	            let matrix = new PathFinder.CostMatrix();
	            this.structureMatrixCache[room.name] = Traveler.addStructuresToMatrix(room, matrix, 1);
	        }
	        return this.structureMatrixCache[room.name];
	    }
	    static initPosition(pos) {
	        return new RoomPosition(pos.x, pos.y, pos.roomName);
	    }
	    static addStructuresToMatrix(room, matrix, roadCost) {
	        for (let structure of room.find(FIND_STRUCTURES)) {
	            if (structure instanceof StructureRampart) {
	                if (!structure.my) {
	                    matrix.set(structure.pos.x, structure.pos.y, 0xff);
	                }
	            }
	            else if (structure instanceof StructureRoad) {
	                matrix.set(structure.pos.x, structure.pos.y, roadCost);
	            }
	            else if (structure.structureType !== STRUCTURE_CONTAINER) {
	                // Can't walk through non-walkable buildings
	                matrix.set(structure.pos.x, structure.pos.y, 0xff);
	            }
	        }
	        for (let site of room.find(FIND_CONSTRUCTION_SITES)) {
	            if (site.structureType === STRUCTURE_CONTAINER || site.structureType === STRUCTURE_ROAD) {
	                continue;
	            }
	            matrix.set(site.pos.x, site.pos.y, 0xff);
	        }
	        return matrix;
	    }
	    getCreepMatrix(room) {
	        this.refreshMatrices();
	        if (!this.creepMatrixCache[room.name]) {
	            this.creepMatrixCache[room.name] = Traveler.addCreepsToMatrix(room, this.getStructureMatrix(room).clone());
	        }
	        return this.creepMatrixCache[room.name];
	    }
	    static addCreepsToMatrix(room, matrix) {
	        room.find(FIND_MY_CREEPS).forEach((creep) => {
	            if(creep.memory._travel && creep.memory._travel.end && creep.memory._travel.tick >= Game.time - 1){
	                matrix.set(creep.memory._travel.end.x, creep.memory._travel.end.y, 0x10);
	            }
	            matrix.set(creep.pos.x, creep.pos.y, creep.memory.sitting || 0xff);
	        });
	        return matrix;
	    }
	    static serializePath(startPos, path) {
	        let serializedPath = "";
	        let lastPosition = startPos;
	        for (let position of path) {
	            if (position.roomName === lastPosition.roomName) {
	                serializedPath += lastPosition.getDirectionTo(position);
	            }
	            lastPosition = position;
	        }
	        return serializedPath;
	    }
	    refreshMatrices() {
	        if (Game.time !== this.currentTick) {
	            this.currentTick = Game.time;
	            this.structureMatrixCache = {};
	            this.creepMatrixCache = {};
	        }
	    }
	    static positionAtDirection(origin, direction) {
	        let offsetX = [0, 0, 1, 1, 1, 0, -1, -1, -1];
	        let offsetY = [0, -1, -1, 0, 1, 1, 1, 0, -1];
	        return new RoomPosition(origin.x + offsetX[direction], origin.y + offsetY[direction], origin.roomName);
	    }
	}
	// exports.Traveler = Traveler;

	// uncomment this to have an instance of traveler available through import
	// exports.traveler = new Traveler();

	// uncomment to assign an instance to global
	// global.traveler = new Traveler();

	// uncomment this block to assign a function to Creep.prototype: creep.travelTo(destination)
	const traveler = new Traveler();
	Creep.prototype.travelTo = function (destination, options) {
	    return traveler.travelTo(this, destination, options);
	};
	module.exports = traveler;

/***/ },
/* 8 */
/***/ function(module, exports) {

	"use strict";

	// global, but fancier

	function catalogStorage(resources, storage){
	    var stored = storage.getResourceList();
	    for(let type in stored){
	        let amount = stored[type];
	        resources[type].total += amount;
	        resources[type].totals[storage.structureType] += amount;
	        resources[type][storage.structureType].push(storage);
	        if(type != RESOURCE_ENERGY || storage.structureType == STRUCTURE_STORAGE){
	            resources[type].stored += amount;
	            resources[type].sources.push(storage);
	        }
	    }
	}

	class Hegemony {
	    constructor(){}

	    get structures(){
	        if(!this._structures){
	            this.initStructures();
	        }
	        return this._structures;
	    }

	    initStructures(){
	        this._structures = _.assign({
	            spawn: [],
	            extension: [],
	            rampart: [],
	            controller: [],
	            link: [],
	            storage: [],
	            tower: [],
	            observer: [],
	            powerBank: [],
	            powerSpawn: [],
	            extractor: [],
	            lab: [],
	            terminal: [],
	            nuker: []
	        }, _.groupBy(Game.structures, 'structureType'));
	    }

	    get resources(){
	        if(!this._resources){
	            this.initResources();
	        }
	        return this._resources;
	    }

	    initResources(){
	        this._resources = _.zipObject(RESOURCES_ALL, _.map(RESOURCES_ALL, resource => {
	            return {
	                total: 0,
	                stored: 0,
	                sources: [],
	                storage: [],
	                terminal: [],
	                totals: {
	                    storage: 0,
	                    terminal: 0
	                }
	            };
	        }));
	        let cataFn = catalogStorage.bind(this, this._resources);
	        _.forEach(this.structures.storage, cataFn);
	        _.forEach(this.structures.terminal, cataFn);
	    }

	}

	module.exports = Hegemony;

	//Game.hegemony.resources.H.terminal.map(terminal=>terminal.send('H', terminal.store.H || 0, 'E28S73'))

/***/ },
/* 9 */
/***/ function(module, exports) {

	"use strict";

	function pos2ix(pos){
	    return pos.y*50+pos.x;
	}

	function xy2ix(x, y){
	    return y*50+x;
	}

	function ix2xy(ix, out){
	    out[0] = ix % 50;
	    out[1] = Math.floor(ix / 50);
	}

	function ix2pos(ix, roomName){
	    return new RoomPosition(ix % 50, Math.floor(ix / 50), roomName);
	}


	function ix2x(ix){
	    return ix % 50;
	}

	function ix2y(ix){
	    return Math.floor(ix / 50);
	}

	var CLEAR_RANGE = 4;

	var cornerpos = [
	    [-1, -1],
	    [1, 1],
	    [1, -1],
	    [-1, 1]
	];
	var rpos = [
	    [-1, 0],
	    [1, 0],
	    [0, -1],
	    [0, 1]
	];
	var doublerpos = [
	    [-2, 0],
	    [2, 0],
	    [0, -2],
	    [0, 2]
	];

	class AutoBuilder {
	    constructor(room){
	        this.room = room;
	        this.grid = new Array(2500).fill(0);
	        this.values = {
	            none: 0,
	            plain: 1,
	            swamp: 2,
	            road: 3,
	            wall: 4,
	            source: 5,
	            container: 6,
	            spawn: 7,
	            extension: 8,
	            storage: 9,
	            link: 10,
	            misc: 11
	        }
	        this.buildings = {};
	        this.sources = [];
	        this.keys = _.keys(this.values);
	        this.vis = new RoomVisual(room.name);
	    }

	    static processRoadFlags(){
	        if(Game.flags.roadStart && Game.flags.roadEnd){
	            let built = AutoBuilder.buildRoads(Game.flags.roadStart.pos, Game.flags.roadEnd.pos);
	            if(built == 0){
	                Game.flags.roadStart.remove();
	                Game.flags.roadEnd.remove();
	            }
	        }
	        if(Game.flags.harvestRoad || Game.flags.harvestRoadDebug){
	            let flag = Game.flags.harvestRoad || Game.flags.harvestRoadDebug;
	            let room = flag.room;
	            if(room && room.hasCluster()){
	                let storage = AutoBuilder.findNearest(room.getCluster(), flag.pos, STRUCTURE_STORAGE);
	                if(storage){
	                    let remaining = AutoBuilder.buildRoads(flag.pos, storage.pos, flag.name.indexOf('Debug') >= 0);
	                    if(remaining == 0){
	                        flag.remove();
	                    }
	                }
	            }
	        }
	    }

	    static findNearest(cluster, pos, type){
	        return  _.first(_.sortBy(cluster.structures[type], struct => pos.getLinearDistance(struct)));
	    }

	    static buildInfrastructureRoads(cluster){
	        if(cluster.structures.storage.length > 0 && _.size(Game.constructionSites) < 20){
	            for(let source of cluster.findAll(FIND_SOURCES)){
	                let storage = AutoBuilder.findNearest(cluster, source.pos, STRUCTURE_STORAGE);
	                if(storage){
	                    AutoBuilder.buildRoads(source.pos, storage.pos);
	                }
	            }
	            for(let extractor of cluster.getAllStructures([STRUCTURE_EXTRACTOR, STRUCTURE_CONTROLLER])){
	                let storage = AutoBuilder.findNearest(cluster, extractor.pos, STRUCTURE_STORAGE);
	                if(storage){
	                    AutoBuilder.buildRoads(extractor.pos, storage.pos);
	                }
	            }
	        }
	    }

	    static buildRoads(start, end, debug){
	        let visuals = {};
	        visuals[start.roomName] = new RoomVisual(start.roomName);
	        let result = PathFinder.search(start, { pos: end, range: 1 }, {
	            plainCost: 2,
	            swampCost: 2,
	            roomCallback: function(roomName) {
	                let room = Game.rooms[roomName];
	                if (!room) return;
	                let costs = new PathFinder.CostMatrix();
	                for(let structure of room.find(FIND_STRUCTURES)){
	                    if (structure.structureType === STRUCTURE_ROAD) {
	                        costs.set(structure.pos.x, structure.pos.y, 1);
	                    } else if (structure.structureType !== STRUCTURE_CONTAINER && 
	                              (structure.structureType !== STRUCTURE_RAMPART || !structure.my)) {
	                        costs.set(structure.pos.x, structure.pos.y, 0xff);
	                    }
	                }
	                for(let site of room.find(FIND_MY_CONSTRUCTION_SITES)){
	                    if (site.structureType === STRUCTURE_ROAD) {
	                        costs.set(site.pos.x, site.pos.y, 1);
	                    } else if (site.structureType !== STRUCTURE_CONTAINER && 
	                              (site.structureType !== STRUCTURE_RAMPART)) {
	                        costs.set(site.pos.x, site.pos.y, 0xff);
	                    }
	                }
	                return costs;
	            }
	        });
	        let remaining = _.size(result.path);
	        for(let pos of result.path){
	            if(pos.x == 0 || pos.x == 49 || pos.y == 0 || pos.y == 49){
	                remaining--;
	                continue;
	            }
	            if(!visuals[pos.roomName]){
	                visuals[pos.roomName] = new RoomVisual(pos.roomName);
	            }
	            visuals[pos.roomName].rect(pos.x - 0.25, pos.y - 0.25, 0.5, 0.5, { fill: '#2892D7' });
	            if(!debug && Game.rooms[pos.roomName]){
	                let construct = pos.createConstructionSite(STRUCTURE_ROAD);
	                if(construct == OK || construct == ERR_INVALID_TARGET){
	                    remaining--;
	                }
	            }
	        }
	        return remaining;
	    }

	    buildTerrain(){
	        var swampStyle = { fill: '#c0ffee' };
	        var roomName = this.room.name;
	        for(var ix = 1; ix < 49; ix++){
	            for(var iy = 1; iy < 49; iy++){
	                var terrain = Game.map.getTerrainAt(ix, iy, roomName);
	                this.grid[xy2ix(ix, iy)] = this.values[terrain];
	            }
	        }
	        this.sources = this.room.find(FIND_SOURCES);
	        for(let source of this.sources){
	            this.grid[pos2ix(source.pos)] = this.values.source;
	        }
	        this.structures = this.room.find(FIND_STRUCTURES);
	        for(let struct of this.structures){
	            if(struct.structureType != 'road'){
	                if(!this.buildings[struct.structureType]){
	                    this.buildings[struct.structureType] = [];
	                }
	                this.buildings[struct.structureType].push(struct);
	            }
	            let pos = pos2ix(struct.pos);
	            this.grid[pos] = Math.max(this.grid[pos], _.get(this.values, struct.structureType, this.values.misc));
	            if(struct.structureType == STRUCTURE_SPAWN && !this.spawn){
	                this.spawn = struct;
	            }
	        }
	        this.sites = this.room.find(FIND_MY_CONSTRUCTION_SITES);
	        for(let struct of this.sites){
	            this.grid[pos2ix(struct.pos)] = _.get(this.values, struct.structureType, this.values.misc);
	        }
	    }

	    countNearby(gridTypes, idx, radius){
	        var count = 0;
	        var x = ix2x(idx);
	        var y = ix2y(idx);
	        for(let iy = Math.max(1, y - radius); iy <= Math.min(48, y + radius); iy++){
	            var xoff = iy * 50;
	            for(let ix = Math.max(1, x - radius); ix <= Math.min(48, x + radius); ix++){
	                if(gridTypes.includes(this.grid[xoff + ix])){
	                    count++;
	                }
	                // this.vis.rect(ix - 0.25, iy - 0.25, 0.5, 0.5, { fill: '#ff0000', opacity: 0.25 });
	            }
	        }
	        return count;
	    }

	    generateBuildingList(){
	        var extensions = [];
	        if(this.spawn){
	            var out = new Set();
	            this.placeExtensions(this.spawn.pos.x, this.spawn.pos.y, 0, new Set(), doublerpos, out);
	            extensions = _.sortBy([...out], extension => this.spawn.pos.getRangeTo(ix2pos(extension, this.room.name)));
	        }
	        return {
	            containers: [...this.placeContainers()],
	            roads: [...this.placeRoads()],
	            extensions
	        }
	    }

	    addWeights(x, y, minX, maxX, minY, maxY, weights){
	        var pos = xy2ix(x, y);
	        for(var iy = Math.max(y - 1, minY); iy <= Math.min(y + 1, maxY); iy++){
	            for(var ix = Math.max(x - 1, minX); ix <= Math.min(x + 1, maxX); ix++){
	                var target = this.grid[xy2ix(ix, iy)];
	                if(target < CLEAR_RANGE){
	                    weights[pos] = _.get(weights, pos, 0) + 1;
	                }
	            }
	        }
	    }

	    findAccessibleSpot(origin, radius){
	        var weights = {};
	        var minX = Math.max(1, origin.x - radius);
	        var maxX = Math.min(48, origin.x + radius);
	        var minY = Math.max(1, origin.y - radius);
	        var maxY = Math.min(48, origin.y + radius);
	        for(var y = minY; y <= maxY; y++){
	            for(var x = minX; x <= maxX; x++){
	                if(y != origin.y || x != origin.x){
	                    let pos = xy2ix(x, y);
	                    if(this.grid[pos] < CLEAR_RANGE){
	                        this.addWeights(x, y, minX, maxX, minY, maxY, weights);
	                    }
	                }
	            }
	        }
	        let target = false;
	        let max = 0;
	        _.forEach(weights, (weight, pos) => {
	            if(weight > max){
	                target = pos;
	                max = weight;
	            }
	        });
	        return target;
	    }

	    placeContainers(){
	        var containerPos = new Set();
	        var pos = 0;
	        var sources = this.sources;
	        if(this.room.memory.role == 'core' || this.room.memory.keep){
	            sources = sources.concat(this.room.find(FIND_MINERALS) || []);
	        }
	        for(let source of sources){
	            if(this.countNearby([this.values.container, this.values.storage, this.values.link], pos2ix(source.pos), 2) > 0){
	                continue;
	            }
	            let target = this.findAccessibleSpot(source.pos, 1);
	            if(target){
	                this.vis.circle(ix2x(target), ix2y(target), { fill: '#ff0000' });
	                containerPos.add(target);
	            }
	        }
	        if(this.room.controller && this.room.memory.role == 'core'){
	            let pos = this.room.controller.pos;
	            if(this.countNearby([this.values.container, this.values.storage, this.values.link], pos2ix(pos), 2) == 0){
	                let target = this.findAccessibleSpot(pos, 2);
	                if(target){
	                    this.vis.circle(ix2x(target), ix2y(target), { fill: '#ff0000' });
	                    containerPos.add(target);
	                }
	            }
	        }
	        return containerPos;
	    }

	    addRoadsAround(struct, roads, radius){
	        for(var iy = Math.max(struct.pos.y - radius, 1); iy <= Math.min(struct.pos.y + radius, 48); iy++){
	            for(var ix = Math.max(struct.pos.x - radius, 1); ix <= Math.min(struct.pos.x + radius, 48); ix++){
	                var pos = xy2ix(ix, iy);
	                var target = this.grid[pos];
	                if(target < 3 && (ix != struct.pos.x || iy != struct.pos.y)){
	                    roads.add(pos);
	                }
	            }
	        }
	    }

	    placeRoads(){
	        var roads = new Set();
	        for(let struct of this.structures){
	            switch(struct.structureType){
	                case STRUCTURE_EXTRACTOR:
	                    this.extractor = struct;
	                    this.addRoadsAround(struct, roads, 2);
	                    break;
	                case STRUCTURE_SPAWN:
	                case STRUCTURE_STORAGE:
	                    this.addRoadsAround(struct, roads, 1);
	                    break;
	                case STRUCTURE_CONTROLLER:
	                    if(this.room.memory.role == 'core'){
	                        this.addRoadsAround(struct, roads, 2);
	                    }
	                    break;
	                case STRUCTURE_EXTENSION:
	                    for(let pos of rpos){
	                        var target = xy2ix(struct.pos.x + pos[0], struct.pos.y + pos[1]);
	                        if(this.grid[target] < 3){
	                            roads.add(target);
	                        }
	                    }
	                    break;
	            }
	        }
	        for(let source of this.sources){
	            this.addRoadsAround(source, roads, 2);
	        }
	        for(let road of roads){
	            this.vis.rect(ix2x(road) - 0.25, ix2y(road) - 0.25, 0.5, 0.5, { fill: '#999999', opacity: 0.25 });
	        }
	        return roads;
	    }

	    hasSidesClear(x, y){
	        var result = true;
	        var current = this.grid[xy2ix(x, y)];
	        if(current == this.values.extension){
	            return true;
	        }
	        if(current < CLEAR_RANGE){
	            for(let pos of rpos){
	                var ix = x + pos[0];
	                var iy = y + pos[1];
	                var target = this.grid[xy2ix(ix, iy)];
	                if(target >= CLEAR_RANGE){
	                    result = false;
	                }
	            }
	        }else{
	            result = false;
	        }
	        return result;
	    }

	    placeExtensions(x, y, count, exhausted, distanceList, output){
	        var current = xy2ix(x, y);
	        if(count > 5 || exhausted.has(current) || x < 5 || y < 5 || x > 45 || y > 45){
	            return;
	        }
	        exhausted.add(current);
	        for(let pos of distanceList){
	            var dx = x + pos[0];
	            var dy = y + pos[1];
	            var target = xy2ix(dx, dy);
	            if(this.hasSidesClear(dx, dy)){
	                if(this.grid[target] != this.values.extension && !exhausted.has(target) && !output.has(target) && this.spawn.pos.getRangeTo(new RoomPosition(dx, dy, this.room.name)) > 1){
	                    output.add(target);
	                    count++;
	                    this.vis.rect(dx - 0.25, dy - 0.25, 0.5, 0.5, { fill: '#00ff00', opacity: 0.25 });
	                }
	                this.placeExtensions(dx, dy, count, exhausted, cornerpos, output);
	            }
	        }
	    }

	    autobuild(structs){
	        if(structs.roads.length > 0){
	            structs.roads.forEach((ix)=>{
	                let targetPos = ix2pos(ix, this.room.name);
	                targetPos.createConstructionSite(STRUCTURE_ROAD);
	            });
	        }
	        if(structs.extensions.length > 0 && this.room.getAvailableStructureCount(STRUCTURE_EXTENSION) > 0){
	            let targetPos = ix2pos(_.first(structs.extensions), this.room.name);
	            console.log('Building extension at', targetPos);
	            targetPos.createConstructionSite(STRUCTURE_EXTENSION);
	        }
	        if(structs.containers.length > 0 && this.room.getAvailableStructureCount(STRUCTURE_CONTAINER) > 0){
	            let targetPos = ix2pos(_.first(structs.containers), this.room.name);
	            console.log('Building container at', targetPos);
	            targetPos.createConstructionSite(STRUCTURE_CONTAINER);
	        }
	        if(!this.extractor && this.room.memory.role == 'core' && this.room.getAvailableStructureCount(STRUCTURE_EXTRACTOR) > 0){
	            let mineral = _.first(this.room.find(FIND_MINERALS));
	            if(mineral){
	                console.log('Building extractor at', mineral.pos);
	                mineral.pos.createConstructionSite(STRUCTURE_EXTRACTOR);
	            }
	        }
	        this.placeTags();
	    }

	    findNearby(pos, type, range){
	        var buildings = this.buildings[type] || [];
	        return _.filter(buildings, struct => pos.getRangeTo(struct) <= range);
	    }

	    findNearbyTypes(pos, types, range){
	        return _.filter(this.structures, struct => types.includes(struct.structureType) && pos.getRangeTo(struct) <= range);
	    }

	    placeTags(){
	        if(this.room.controller && this.room.memory.role == 'core'){
	            let pos = this.room.controller.pos;
	            let containers = this.findNearby(pos, STRUCTURE_CONTAINER, 3);
	            if(containers.length > 0 && !containers.some(container => container.hasTag('stockpile'))){
	                for(let container of containers){
	                    if(!container.hasTag('stockpile')){
	                        container.addTag('stockpile');
	                        console.log('Added stockpile tag to', container, 'in', container.pos.roomName);
	                        break;
	                    }
	                }
	            }
	            let links = this.findNearby(pos, STRUCTURE_LINK, 3);
	            if(links.length > 0 && !links.some(link => link.hasTag('output'))){
	                for(let link of links){
	                    if(!link.hasTag('output')){
	                        link.addTag('output');
	                        console.log('Added link output tag to', link, 'in', link.pos.roomName);
	                        break;
	                    }
	                }
	            }
	        }
	        for(let source of this.sources){
	            let links = this.findNearby(source.pos, STRUCTURE_LINK, 2);
	            if(links.length > 0 && !links.some(link => link.hasTag('input'))){
	                for(let link of links){
	                    if(!link.hasTag('input')){
	                        link.addTag('input');
	                        console.log('Added link input tag to', link, 'in', link.pos.roomName);
	                        break;
	                    }
	                }
	            }
	        }
	        // cluster.update('labs', _.filter(_.map(cluster.rooms, room => _.map(cluster.getStructuresByType(room, STRUCTURE_LAB), 'id')), list => list.length > 0));
	    }



	}

	module.exports = AutoBuilder;

/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const Util = __webpack_require__(11);
	const roomRegex = /([WE])(\d+)([NS])(\d+)/;

	class Controller {

	    static hegemony(allocated){
	        if(Game.interval(20)){
	            var buildFlags = Flag.getByPrefix('Build');
	            _.forEach(buildFlags, flag => Controller.buildFlag(flag));

	            Controller.levelTerminals();
	        }
	        if(_.size(Memory.observe) > 0){
	            var observers = _.filter(Game.hegemony.structures.observer, struct => !_.includes(allocated, struct.id));
	            for(let roomName in Memory.observe){
	                let observer = _.min(observers, ob => Game.map.getRoomLinearDistance(roomName, ob.pos.roomName));
	                if(observer && Game.map.getRoomLinearDistance(roomName, observer.pos.roomName) < 10){
	                    _.pull(observers, observer);
	                    observer.observeRoom(roomName);
	                }else{
	                    console.log('No observer for', roomName);
	                }
	            }
	        }
	    }

	    static control(cluster, allocated){

	        var scanner = Game.getObjectById(cluster.scanner);
	        if(scanner){
	            allocated.push(scanner.id);
	            var scanPos = roomRegex.exec(scanner.pos.roomName);
	            if(scanPos){
	                var lastX = (Game.time % 18) - 9 + parseInt(scanPos[2]);
	                var lastY = Math.floor((Game.time % 324) / 18) - 9 + parseInt(scanPos[4]);
	                var scanRoom = Game.rooms[scanPos[1]+lastX+scanPos[3]+lastY];
	                if(scanRoom){
	                    var owner = _.get(scanRoom, 'controller.owner.username');
	                    var reserved = _.get(scanRoom, 'controller.reservation.username');
	                    if(owner && !scanRoom.controller.my){
	                        Memory.avoidRoom[scanRoom.name] = true;
	                    }else if(reserved && reserved != 'Zeekner'){
	                        Memory.avoidRoom[scanRoom.name] = true;
	                    }else{
	                        delete Memory.avoidRoom[scanRoom.name];
	                    }
	                }

	                var targetX = ((Game.time + 1) % 18) - 9 + parseInt(scanPos[2]);
	                var targetY = Math.floor(((Game.time + 1) % 324) / 18) - 9 + parseInt(scanPos[4]);
	                var queueRoom = scanPos[1]+targetX+scanPos[3]+targetY;
	                scanner.observeRoom(queueRoom);
	            }
	        }

	        _.forEach(cluster.structures.tower, tower=>{
	            let action = false;
	            if(tower.energy >= 10){
	                let hostile = _.first(cluster.find(tower.room, FIND_HOSTILE_CREEPS));
	                if(hostile){
	                    action = tower.attack(hostile) == OK;
	                }
	                if(!action && Game.interval(5)){
	                    let hurtCreep = _.first(_.filter(cluster.find(tower.room, FIND_MY_CREEPS), creep => creep.hits < creep.hitsMax));
	                    if(hurtCreep){
	                        tower.heal(hurtCreep);
	                    }
	                }
	            }
	        });

	        if(Game.interval(10)){
	            Controller.linkTransfer(cluster);

	            _.forEach(cluster.reaction, (data, type) => Controller.runReaction(cluster, type, data));
	        }
	    }

	    static buildFlag(flag){
	        if(!flag.room){
	            return;
	        }
	        let cluster = flag.room.getCluster();
	        var args = flag.name.split('-');
	        var type = args[1];
	        if(!_.has(CONSTRUCTION_COST, type)){
	            console.log('unknown buildflag', type);
	            Game.note('buildFlagUnknown', 'Unknown buildflag: ' + type + '-' + flag.pos);
	            flag.remove();
	        }
	        var rcl = _.get(flag, 'room.controller.level', 0);
	        let count = _.size(cluster.getStructuresByType(flag.room, type));
	        count += _.size(_.filter(cluster.find(flag.room, FIND_MY_CONSTRUCTION_SITES), site => site.structureType == type));
	        if(_.get(CONTROLLER_STRUCTURES, [type, rcl], 0) > count){
	            console.log('Building', type, 'at', flag.pos, rcl);
	            var result = flag.pos.createConstructionSite(type);
	            if(result == OK){
	                flag.remove();
	            }else{
	                Game.note('buildFlagFailed', 'Failed to buildFlag: ' + type + '-' + flag.pos);
	            }
	        }
	    }

	    //// Links ////

	    static linkTransfer(cluster){
	        let tags = cluster.getTaggedStructures();
	        let linkInput = _.groupBy(tags.input, 'pos.roomName');
	        _.forEach(tags.output, target => {
	            if(target.energy < target.energyCapacity - 50){
	                let sources = _.filter(linkInput[target.pos.roomName] || [], link => link.energy > 50 && link.cooldown == 0);
	                if(sources.length > 0){
	                    let source = _.first(_.sortBy(sources, src => -src.energy));
	                    source.transferEnergy(target, Math.min(source.energy, target.energyCapacity - target.energy));
	                }
	            }
	        });
	    }

	    //// Terminals ////

	    static levelTerminals(){
	        let transferred = {};
	        let terminals = Game.hegemony.structures.terminal;
	        let terminalCount = terminals.length;
	        let ideal = 5000;
	        let idealTotal = ideal * terminalCount;
	        _.forEach(Game.hegemony.resources, (data, type)=>{
	            if(type == RESOURCE_ENERGY || data.stored < ideal){
	                return;
	            }

	            let needed = _.filter(terminals, terminal => terminal.getResource(type) < ideal - 100);
	            let excess = _.filter(terminals, terminal => !transferred[terminal.id] && terminal.getResource(type) > ideal + 100 && terminal.getResource(RESOURCE_ENERGY) > 20000);
	            if(needed.length > 0 && excess.length > 0){
	                let source = _.last(Util.sort.resource(type, excess));
	                let destination = _.first(Util.sort.resource(type, needed));
	                let sourceAmount = source.getResource(type);
	                var destinationAmount = destination.getResource(type);
	                var sending = Math.min(sourceAmount - ideal, ideal - destinationAmount);
	                if(sending >= 100){
	                    console.log('Transferring', sending, type, 'from', source.pos.roomName, 'to', destination.pos.roomName);
	                    transferred[source.id] = source.send(type, sending, destination.pos.roomName) == OK;
	                    return;
	                }
	            }
	        });
	        return transferred;
	    }

	    //// Reactions ////

	    static runReaction(cluster, type, data){
	        var labSet = data.lab;
	        var labs = Game.getObjects(cluster.labs[data.lab]);
	        for(var ix=2;ix<labs.length;ix++){
	            Controller.react(type, labs[ix], labs[0], labs[1], data.components);
	        }
	    }

	    static react(type, targetLab, labA, labB, components){
	        if(!targetLab || !labA || !labB){
	            Game.note('labnotify', 'invalid lab for reaction: ' + type);
	            return false;
	        }
	        if(targetLab.cooldown > 0 || targetLab.mineralAmount == targetLab.mineralCapacity){
	            return;
	        }
	        if(labA.mineralType != components[0] || labB.mineralType != components[1]){
	            return;
	        }
	        if(labA.mineralAmount == 0 || labB.mineralAmount == 0){
	            return;
	        }
	        targetLab.runReaction(labA, labB);
	    }

	    // static towerDefend(tower, catalog, targets) {
	    //     var hostiles = _.filter(targets, target => tower.pos.roomName == target.pos.roomName);
	    //     if(hostiles.length == 0){
	    //         return false;
	    //     }
	    //     var healer = _.find(hostiles, creep => creep.getActiveBodyparts(HEAL) > 0);
	    //     if(healer){
	    //         return tower.attack(healer) == OK;
	    //     }
	    //     if(hostiles.length > 0) {
	    //         var enemies = _.sortBy(hostiles, (target)=>tower.pos.getRangeTo(target));
	    //         return tower.attack(enemies[0]) == OK;
	    //     }
	    //     return false;
	    // }

	    // static towerHeal(tower, catalog, creeps) {
	    //     var injuredCreeps = _.filter(creeps, target => tower.pos.roomName == target.pos.roomName);
	    //     if(injuredCreeps.length > 0) {
	    //         var injuries = _.sortBy(injuredCreeps, creep => creep.hits / creep.hitsMax);
	    //         return tower.heal(injuries[0]) == OK;
	    //     }
	    //     return false;
	    // }

	    // static towerRepair(tower, catalog, repairTargets) {
	    //     if(!tower){
	    //         Util.notify('towerbug', 'missing tower somehow!?');
	    //         return;
	    //     }
	    //     var targets = _.filter(repairTargets, target => tower && target && tower.pos.roomName == target.pos.roomName);
	    //     if(targets.length > 0) {
	    //         var damaged = _.sortBy(targets, structure => structure.hits / Math.min(structure.hitsMax, Memory.settings.repairTarget));
	    //         tower.repair(damaged[0]);
	    //     }
	    // }

	    // static boost(type, labId){
	    //     Memory.transfer.lab[labId] = type;
	    //     var lab = Game.getObjectById(labId);
	    //     if(!lab){
	    //         delete Memory.production.boosts[labId];
	    //         Game.notify('Boost Lab no longer valid: '+labId + ' - ' + type);
	    //         return;
	    //     }
	    //     if(lab.mineralType == type && lab.mineralAmount > 500 && lab.energy > 500){
	    //         if(!Memory.boost.labs[type]){
	    //             Memory.boost.labs[type] = [];
	    //             Memory.boost.rooms[type] = [];
	    //         }
	    //         Memory.boost.stored[type] = _.get(Memory.boost.stored, type, 0) + lab.mineralAmount;
	    //         Memory.boost.labs[type].push(lab.id);
	    //         Memory.boost.rooms[type].push(lab.pos.roomName);
	    //     }
	    // }

	// {
	// 	id : "55c34a6b5be41a0a6e80c68b", 
	// 	created : 13131117, 
	// 	active: true,
	// 	type : "sell"    
	// 	resourceType : "OH", 
	// 	roomName : "W1N1", 
	// 	amount : 15821, 
	// 	remainingAmount : 30000,
	// 	totalAmount : 50000,
	// 	price : 2.95    
	// }
	    // static sellOverage(catalog){
	    //     var sold = false;
	    //     var terminalCount = _.size(catalog.buildings.terminal);
	    //     var ideal = Memory.settings.terminalIdealResources;
	    //     var max = terminalCount * ideal;
	    //     var orders = {};
	    //     _.forEach(Game.market.orders, order =>{
	    //         if(order.active && order.type == ORDER_SELL){
	    //             orders[order.resourceType] = order;
	    //         }
	    //     });
	    //     _.forEach(catalog.resources, (data, type)=>{
	    //         var overage = data.totals.terminal - max;
	    //         if(!sold && type != RESOURCE_ENERGY && overage > 20000 && Game.market.credits > 10000 && data.totals.storage > 50000){
	    //             if(!_.has(prices, type)){
	    //                 console.log('want to sell', type, 'but no price');
	    //                 return;
	    //             }
	    //             var existing = orders[type];
	    //             if(!existing){
	    //                 var source = _.first(_.sortBy(data.terminal, terminal => -Util.getResource(terminal, type)));
	    //                 var holding = Util.getResource(source, type);
	    //                 console.log('selling from', source.pos.roomName, overage, holding, prices[type]);
	    //                 sold = Game.market.createOrder(ORDER_SELL, type, prices[type], Math.min(overage, holding), source.pos.roomName) == OK;
	    //                 if(sold){
	    //                     console.log('created order', type, Math.min(overage, holding));
	    //                 }
	    //             }else if(existing && existing.remainingAmount < 250){
	    //                 console.log('cancelling order', existing.orderId, existing.remainingAmount, overage);
	    //                 sold = Game.market.cancelOrder(existing.orderId) == OK;
	    //             }

	    //         }
	    //     });
	    // }
	}

	module.exports = Controller;

/***/ },
/* 11 */
/***/ function(module, exports) {

	"use strict";

	class SortPredicates {

	    static storage(entity){
	        return entity.getStorage();
	    }

	    static capacity(entity){
	        return entity.getCapacity() - entity.getStored();
	    }

	    static distance(target){
	        return function(entity){
	            return entity.pos.getLinearDistance(target);
	        }
	    }

	    static distancePath(target){
	        return function(entity){
	            return entity.pos.getPathDistance(target);
	        }
	    }

	    static resource(type){
	        return function(entity){
	            return entity.getResource(type);
	        }
	    }
	}

	class Sorting {
	    static resource(type, entities){
	        return _.sortBy(entities, SortPredicates.resource(type));
	    }
	    
	    static closest(entity, entities){
	        return _.sortBy(entities, SortPredicates.distance(entity));
	    }
	    
	    static closestPath(entity, entities){
	        return _.sortBy(entities, SortPredicates.distancePath(entity));
	    }
	}

	module.exports = {
	    sort: Sorting,
	    predicates: {
	        sort: SortPredicates
	    }
	};

/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const config = __webpack_require__(5);

	const workerCtors = {
	    attack: __webpack_require__(13),
	    build: __webpack_require__(15),
	    defend: __webpack_require__(16),
	    deliver: __webpack_require__(17),
	    dismantle: __webpack_require__(18),
	    heal: __webpack_require__(19),
	    idle: __webpack_require__(20),
	    keep: __webpack_require__(21),
	    mine: __webpack_require__(22),
	    observe: __webpack_require__(23),
	    pickup: __webpack_require__(24),
	    repair: __webpack_require__(25),
	    reserve: __webpack_require__(26),
	    transfer: __webpack_require__(27),
	    upgrade: __webpack_require__(28)
	};

	const Behavior = __webpack_require__(29);

	class Worker {
	    static process(cluster){
	        // Game.perfAdd();
	        const workers = _.mapValues(workerCtors, ctor => new ctor());
	        const behaviors = Behavior();
	        const creeps = _.filter(cluster.creeps, 'ticksToLive');
	        _.forEach(creeps, Worker.validate.bind(this, workers, behaviors, cluster));
	        // Game.perfAdd('validate');
	        _.forEach(creeps, Worker.work.bind(this, workers, behaviors, cluster));

	        if(Game.interval(20) || cluster.requestedQuota){
	            Worker.generateQuota(workers, cluster);
	        }
	        // Game.perfAdd('quota');
	    }

	    //hydrate, validate, and end jobs
	    static validate(workers, behaviors, cluster, creep){
	        if(creep.memory.lx == creep.pos.x && creep.memory.ly == creep.pos.y){
	            creep.memory.sitting = Math.min(256, creep.memory.sitting * 2);
	        }else{
	            creep.memory.sitting = 3;
	        }
	        creep.memory.lx = creep.pos.x;
	        creep.memory.ly = creep.pos.y;

	        var behave = _.get(config, [creep.memory.type, 'behavior'], false);
	        if(behave){
	            creep.blocked = _.reduce(behave, (result, opts, type)=>{
	                behaviors[type].preWork(cluster, creep, opts);
	                if(result){
	                    return result;
	                }
	                return behaviors[type].shouldBlock(cluster, creep, opts);
	            }, false);
	        }

	        let id = creep.memory.job;
	        let type = creep.memory.jobType;
	        if(id && type){
	            const opts = _.get(config, [creep.memory.type, 'work', type], false);
	            let work = workers[type];
	            let job = work.hydrateJob(cluster, creep.memory.jobSubType, id, creep.memory.jobAllocation);
	            let endJob = (job.killed && !work.keepDeadJob(cluster, creep, opts, job)) || !work.continueJob(cluster, creep, opts, job);
	            if(endJob){
	                // console.log('ending', type, creep.name, job.killed);
	                work.end(cluster, creep, opts, job);
	                creep.memory.job = false;
	                creep.memory.jobType = false;
	                creep.memory.jobSubType = false;
	                creep.memory.jobAllocation = 0;
	                creep.job = null;
	            }else{
	                creep.job = job;
	            }
	        }
	    }

	    //bid and work jobs
	    static work(workers, behaviors, cluster, creep){
	        const workConfig = config[creep.memory.type].work;
	        if(!creep.memory.job){
	            var lowestBid = Infinity;
	            var bidder = _.reduce(workConfig, (result, opts, type) => {
	                if(!workers[type]){
	                    // console.log('missing worker', type);
	                    return result;
	                }
	                var bid = workers[type].bid(cluster, creep, opts);
	                if(bid !== false && bid.bid < lowestBid){
	                    lowestBid = bid.bid;
	                    return bid;
	                }
	                return result;
	            }, false);

	            if(bidder !== false){
	                creep.memory.job = bidder.job.id;
	                creep.memory.jobType = bidder.job.type;
	                creep.memory.jobSubType = bidder.job.subtype;
	                creep.memory.jobAllocation = bidder.allocation;
	                workers[bidder.type].start(cluster, creep, workConfig[bidder.type], bidder.job);
	                workers[bidder.type].registerAllocation(cluster, bidder.job, bidder.allocation);
	                creep.job = bidder.job;
	                // console.log('starting', bidder.job.type, creep.name, bidder.job.id);
	            }
	        }
	        // Game.perfAdd('bid');
	        var behave = _.get(config, [creep.memory.type, 'behavior'], false);
	        if(creep.blocked){
	            behaviors[creep.blocked.type].blocked(cluster, creep, behave[creep.blocked.type], creep.blocked.data);
	        }else{
	            let action = false;
	            if(creep.memory.job && creep.job){
	                let job = creep.job;
	                let type = job.type;
	                action = workers[type].process(cluster, creep, workConfig[type], job, job.target);
	            }
	            _.forEach(behave, (opts, type) => behaviors[type].postWork(cluster, creep, opts, action));
	        }
	        // Game.perfAdd('process');

	    }

	    static generateQuota(workers, cluster){
	        var quota = {};
	        var assignments = {};
	        let cores = cluster.getRoomsByRole('core');
	        let keeper = cluster.getRoomsByRole('keep');
	        let harvest = cluster.getRoomsByRole('harvest').concat(keeper);

	        _.forEach(workers, worker => worker.calculateQuota(cluster, quota));

	        assignments.spawn = _.zipObject(_.map(cores, 'name'), new Array(cores.length).fill(1));
	        assignments.harvest = _.zipObject(_.map(harvest, 'name'), _.map(harvest, room => _.size(cluster.find(room, FIND_SOURCES))));

	        quota.spawnhauler = _.sum(_.map(cores, room => Math.min(1650, room.energyCapacityAvailable)));

	        if(_.size(cluster.structures.storage) > 0){
	            quota.harvesthauler = _.sum(assignments.harvest) * 24;
	        }

	        if(cluster.maxRCL < 5){
	            quota['stockpile-deliver'] = Math.min(quota['stockpile-deliver'], 250 * cluster.maxRCL);
	        }

	        if(cluster.maxRCL >= 7){
	            assignments.keep = _.zipObject(_.map(keeper, 'name'), new Array(keeper.length).fill(1));
	            quota.keep = _.sum(assignments.keep);
	            if(quota.keep > 0){
	                quota.keep++;
	            }
	        }

	        cluster.update('quota', quota);
	        cluster.update('assignments', assignments);
	    }
	}

	module.exports = Worker;

/***/ },
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const priorities = {
	    tower: 0.01,
	    spawn: 0.1,
	    storage: 1
	};

	const BaseWorker = __webpack_require__(14);

	class AttackWorker extends BaseWorker {
	    constructor(){ super('attack', { quota: true, critical: true }); }

	    /// Job ///

	    attack(cluster, subtype){
	        if(cluster.attackSource){
	            return this.jobsForTargets(cluster, subtype, Flag.getByPrefix('attack'));
	        }
	        return [];
	    }

	    calculateCapacity(cluster, subtype, id, target, args){
	        var parts = target.name.split('-');
	        if(parts.length > 2){
	            return parseInt(parts[1]);
	        }
	        return 1;
	    }

	    genTarget(cluster, subtype, id, args){
	        return Game.flags[id];
	    }

	    createId(cluster, subtype, target, args){
	        return target.name;
	    }

	    /// Creep ///

	    calculateBid(cluster, creep, opts, job, distance){
	        return distance / 50;
	    }

	    calculatePriority(creep, target){
	        return creep.pos.getRangeTo(target) * _.get(priorities, target.structureType, 1);
	    }

	    process(cluster, creep, opts, job, flag){
	        var action = false;
	        var target = false;
	        if(creep.pos.roomName == flag.pos.roomName && flag.name.includes('target')){
	            target = flag.getStructure();
	        }
	        var buildings = _.filter(cluster.find(creep.room, FIND_HOSTILE_STRUCTURES), target => _.get(target, 'owner.username', false) != 'Power Bank');
	        let hostiles = cluster.find(creep.room, FIND_HOSTILE_CREEPS);
	        let targets = hostiles.concat(_.filter(buildings, target => _.get(target, 'owner.username', false) != 'Source Keeper' && target.structureType != STRUCTURE_CONTROLLER));
	        if(!target){
	            target = _.first(_.sortBy(targets, target => this.calculatePriority(creep, target)));
	        }
	        if(target){
	            let attack = creep.getActiveBodyparts('attack');
	            let ranged = creep.getActiveBodyparts('ranged_attack');
	            let dist = creep.pos.getRangeTo(target);
	            if(attack > 0){
	                action = this.orAttackMove(creep, target, creep.attack(target)) == OK;
	            }else if(ranged > 0){
	                if(dist < 3){
	                    var result = PathFinder.search(creep.pos, { pos: target.pos, range: 3 }, { flee: true });
	                    creep.move(creep.pos.getDirectionTo(result.path[0]));
	                }else if(dist > 3){
	                    this.attackMove(creep, target);
	                }
	            }
	            if(ranged > 0 && dist <= 3){
	                action = action || creep.rangedAttack(target) == OK;
	            }
	        }else if(creep.pos.getRangeTo(flag) > 3){
	            this.attackMove(creep, flag);
	        }else if(!flag.name.includes('stage')){
	           flag.remove();
	        }
	        return action;
	    }

	}

	module.exports = AttackWorker;

/***/ },
/* 14 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const Pathing = __webpack_require__(2);

	class BaseWorker {
	    constructor(type, opts){
	        this.minEnergy = 1000;
	        this.range = 1;
	        this.priority = 0;
	        this.ignoreRoads = false;
	        if(opts){
	            Object.assign(this, opts);
	        }
	        this.type = type;
	        this.hydratedJobs = {};
	        this.jobs = {};
	        // Game.profileAdd('jobs-'+this.type, 0);
	    }

	    genTarget(cluster, subtype, id, args){
	        if(args){
	            return Game.getObjectById(args.id);
	        }else{
	            return Game.getObjectById(id);
	        }
	    }

	    parseJob(cluster, subtype, id, allocation){
	        let args = false;
	        let target;
	        if(this.args){
	            args = _.zipObject(this.args, id.split('-'));
	        }
	        target = this.genTarget(cluster, subtype, id, args);
	        let capacity = 0;
	        if(target){
	            capacity = this.calculateCapacity(cluster, subtype, id, target, args);
	        }
	        return {
	            capacity,
	            allocation,
	            id,
	            type: this.type,
	            subtype,
	            target,
	            args
	        };
	    }

	    createId(cluster, subtype, target, args){
	        if(this.args){
	            return _.map(this.args, argName => argName == 'id' ? target.id : args[argName]).join('-');
	        }else{
	            return target.id
	        }
	    }

	    createJob(cluster, subtype, target, args){
	        let id = this.createId(cluster, subtype, target, args);
	        return {
	            capacity: this.calculateCapacity(cluster, subtype, id, target, args),
	            allocation: 0,
	            id,
	            type: this.type,
	            subtype,
	            target,
	            args
	        };
	    }

	    jobsForTargets(cluster, subtype, targets, args){
	        return _.map(targets, target => this.createJob(cluster, subtype, target, args));
	    }

	    hydrateJob(cluster, subtype, id, allocation){
	        let job = _.get(this.hydratedJobs, [this.type, subtype, id]);
	        if(job){
	            job.allocation += allocation;
	        }else{
	            job = this.parseJob(cluster, subtype, id, allocation);
	            job.killed = !this.jobValid(cluster, job);
	            _.set(this.hydratedJobs, [this.type, subtype, id], job);
	        }
	        return job;
	    }

	    registerAllocation(cluster, job, allocated){
	        if(!_.has(this.hydratedJobs, [job.type, job.subtype, job.id])){
	            _.set(this.hydratedJobs, [job.type, job.subtype, job.id], job);
	        }
	        let newAlloc = allocated + _.get(this.hydratedJobs, [job.type, job.subtype, job.id, 'allocation'], 0);
	        _.set(this.hydratedJobs, [job.type, job.subtype, job.id, 'allocation'], newAlloc);
	    }

	    move(creep, target){
	        if(this.simpleMove){
	            if(creep.memory.lastX != creep.pos.x || creep.memory.lastY != creep.pos.y){
	                creep.memory.lastX = creep.pos.x;
	                creep.memory.lastY = creep.pos.y;
	                creep.memory.moveTicks = 0;
	            }else if(creep.memory.moveTicks >= 3){
	                delete creep.memory._move;
	            }else{
	                creep.memory.moveTicks++;
	            }
	            return creep.moveTo(target, { reusePath: 50 });
	        }else{
	            return Pathing.moveCreep(creep, target, this.range, this.ignoreRoads);
	        }
	    }

	    attackMove(creep, target){
	        return Pathing.attackMove(creep, target);
	    }

	    orMove(creep, target, result){
	        if(result == ERR_NOT_IN_RANGE){
	            this.move(creep, target);
	        }
	        return result;
	    }

	    orAttackMove(creep, target, result){
	        if(result == ERR_NOT_IN_RANGE){
	            Pathing.attackMove(creep, target);
	        }
	        return result;
	    }

	    moveAway(creep, target, range){
	        var result = PathFinder.search(creep.pos, { pos: target.pos, range }, { flee: true });
	        creep.moveByPath(result.path);
	    }

	    calculateQuota(cluster, quota){
	        if(this.quota === true){
	            let jobs = this.generateJobs(cluster, this.type);
	            quota[this.type] = _.sum(jobs, job => job.capacity);
	        }else if(this.quota){
	            _.forEach(this.quota, subtype => {
	                let jobs = this.generateJobs(cluster, subtype);
	                quota[subtype+'-'+this.type] = _.sum(jobs, job => job.capacity);
	            });
	        } 
	    }

	    //// Lifecycle ////
	    calculateCapacity(cluster, subtype, id, target, args){
	        return 1;
	    }

	    allocate(cluster, creep, opts){
	        return 1;
	    }

	    jobValid(cluster, job){
	        return job.id && job.target;
	    }

	    continueJob(cluster, creep, opts, job){
	        if(this.requiresEnergy){
	            return job.id && job.target && creep.getResource(RESOURCE_ENERGY) > 0;
	        }
	        return job.id && job.target;
	    }

	    keepDeadJob(cluster, creep, opts, job){
	        return false;
	    }

	    generateJobs(cluster, subtype){
	        if(this.requiresEnergy && cluster.totalEnergy < this.minEnergy && this.critical != subtype && !cluster.bootstrap){
	            return [];
	        }
	        if(Game.cpu.bucket < 2500 && this.critical != subtype){
	            return [];
	        }
	        var jobs = this.jobs[subtype];
	        if(!jobs){
	            // Game.profileAdd('jobs-'+this.type, 1);
	            jobs = this.generateJobsForSubtype(cluster, subtype);
	            this.jobs[subtype] = jobs;
	        }
	        return jobs;
	    }

	    generateJobsForSubtype(cluster, subtype){
	        return this[subtype](cluster, subtype);
	    }

	    canBid(cluster, creep, opts){
	        return !this.requiresEnergy || creep.carry.energy > 0;
	    }

	    bid(cluster, creep, opts){
	        if(!this.canBid(cluster, creep, opts)){
	            return false;
	        }
	        let subtype = _.get(opts, 'subtype', this.type);
	        let jobs = this.generateJobs(cluster, subtype);
	        let lowestBid = Infinity;
	        return _.reduce(jobs, (result, job) =>{
	            if(job.capacity <= _.get(this.hydratedJobs, [this.type, subtype, job.id, 'allocation'], 0)){
	                return result;
	            }
	            let distance = creep.pos.getPathDistance(job.target);
	            if(opts.local && creep.memory.room && creep.memory.room != _.get(job, 'target.pos.roomName')){
	                return result;
	            }
	            let bid = this.calculateBid(cluster, creep, opts, job, distance);
	            if(bid !== false){
	                bid += _.get(opts, 'priority', this.priority);
	                if(bid < lowestBid){
	                    let allocation = this.allocate(cluster, creep, opts, job);
	                    lowestBid = bid;
	                    return { allocation, bid, job, type: this.type, subtype };
	                }
	            }
	            return result;
	        }, false);
	    }

	    calculateBid(cluster, creep, opts, job){
	        return false;
	    }

	    start(cluster, creep, opts, job){}
	    process(cluster, creep, opts, job, target){}
	    end(cluster, creep, opts, job){}

	}

	module.exports = BaseWorker;

/***/ },
/* 15 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(14);

	const offsets = {
	    spawn: -1,
	    extension: -0.5,
	    tower: -0.5,
	    container: -0.25
	}

	class BuildWorker extends BaseWorker {
	    constructor(){ super('build', { requiresEnergy: true, quota: true, range: 3, minEnergy: 500 }); }

	    /// Job ///
	    calculateCapacity(cluster, subtype, id, target, args){
	        return  target.progressTotal - target.progress;
	    }

	    build(cluster, subtype){
	        return this.jobsForTargets(cluster, subtype, cluster.findAll(FIND_MY_CONSTRUCTION_SITES));
	    }

	    /// Creep ///

	    calculateBid(cluster, creep, opts, job, distance){
	        return distance / 50 + (1 - job.target.progress / job.target.progressTotal) + (offsets[job.target.structureType] || 0);
	    }

	    allocate(cluster, creep, opts){
	        return creep.getResource(RESOURCE_ENERGY);
	    }

	    process(cluster, creep, opts, job, target){
	        this.orMove(creep, target, creep.build(target));
	    }

	}

	module.exports = BuildWorker;

/***/ },
/* 16 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(14);

	class DefendWorker extends BaseWorker {
	    constructor(){ super('defend', { quota: true }); }

	    /// Job ///

	    defend(cluster, subtype){
	        let hostiles = cluster.findAll(FIND_HOSTILE_CREEPS);
	        return this.jobsForTargets(cluster, subtype, _.filter(hostiles, target => _.get(target, 'owner.username', false) != 'Source Keeper'));
	    }

	    calculateCapacity(cluster, subtype, id, target, args){
	        var value = target.getActiveBodyparts(ATTACK) * 5;
	        value += target.getActiveBodyparts(RANGED_ATTACK) * 3;
	        value += target.getActiveBodyparts(WORK) * 2;
	        value += target.getActiveBodyparts(HEAL) * 5;
	        return Math.max(1, Math.ceil(value / 35));
	    }

	    /// Creep ///

	    calculateBid(cluster, creep, opts, job, distance){
	        return distance / 50;
	    }

	    process(cluster, creep, opts, job, target){
	        let attack = creep.getActiveBodyparts('attack');
	        let ranged = creep.getActiveBodyparts('ranged_attack');
	        let dist = creep.pos.getRangeTo(target);
	        if(attack > 0){
	            this.orMove(creep, target, creep.attack(target));
	        }else if(ranged > 0){
	            if(dist < 3){
	                var result = PathFinder.search(creep.pos, { pos: target.pos, range: 3 }, { flee: true });
	                creep.move(creep.pos.getDirectionTo(result.path[0]));
	            }else if(dist > 3){
	                this.move(creep, target);
	            }
	        }
	        if(ranged > 0 && dist <= 3){
	            creep.rangedAttack(target);
	        }
	    }

	}

	module.exports = DefendWorker;

/***/ },
/* 17 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(14);

	class DeliverWorker extends BaseWorker {
	    constructor(){ super('deliver', { args: ['id', 'resource'], quota: ['stockpile'], critical: 'spawn' }); }

	    /// Job ///
	    calculateCapacity(cluster, subtype, id, target, args){
	        return target.getAvailableCapacity();
	    }

	    spawn(cluster, subtype){
	        var structures = _.filter(cluster.getAllMyStructures([STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_TOWER]), struct => struct.getAvailableCapacity() > 0);
	        return this.jobsForTargets(cluster, subtype, structures, { resource: RESOURCE_ENERGY });
	    }

	    stockpile(cluster, subtype){
	        var tagged = cluster.getTaggedStructures();
	        return this.jobsForTargets(cluster, subtype, tagged.stockpile, { resource: RESOURCE_ENERGY });
	    }

	    storage(cluster, subtype){
	        var structures = _.filter(cluster.getAllMyStructures([STRUCTURE_STORAGE]), storage => storage.getStored() < storage.getCapacity() * 0.8);
	        var tagged = cluster.getTaggedStructures();
	        return this.jobsForTargets(cluster, subtype, structures.concat(tagged.stockpile || []), { resource: RESOURCE_ENERGY });
	    }

	    terminal(cluster, subtype){
	        var terminals = cluster.getAllMyStructures([STRUCTURE_STORAGE]);
	        var jobs = [];
	        for(let terminal of terminals){
	            for(let resource of RESOURCES_ALL){
	                if(resource != RESOURCE_ENERGY){
	                    jobs.push(this.createJob(cluster, subtype, terminal, { resource }));
	                }
	            }
	        }
	        return jobs;
	    }

	    /// Creep ///

	    allocate(cluster, creep, opts, job){
	        return creep.getResource(job.args.resource);
	    }

	    jobValid(cluster, job){
	        return super.jobValid(cluster, job) && job.target.getAvailableCapacity() > 0;
	    }

	    continueJob(cluster, creep, opts, job){
	        return super.continueJob(cluster, creep, opts, job) && creep.getResource(job.args.resource) > 0;
	    }

	    canBid(cluster, creep, opts){
	        return creep.getStored() > 0;
	    }

	    calculateBid(cluster, creep, opts, job, distance){
	        if(creep.getResource(job.args.resource) == 0){
	            return false;
	        }
	        return distance / 50;
	    }

	    process(cluster, creep, opts, job, target){
	        if(creep.pos.getRangeTo(target) > 1){
	            this.move(creep, target);
	        }else{
	            creep.transfer(target, job.args.resource);
	            creep.memory.lastDeliver = target.id;
	        }
	    }

	}

	module.exports = DeliverWorker;

/***/ },
/* 18 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(14);

	class DismantleWorker extends BaseWorker {
	    constructor(){ super('dismantle', { quota: true }); }

	    /// Job ///
	    calculateCapacity(cluster, subtype, id, target, args){
	        return target.hits;
	    }

	    dismantle(cluster, subtype){
	        var flags = Flag.getByPrefix("Dismantle");
	        var type = false;
	        var targets = [];
	        for(let flag of flags){
	            let roomName = flag.pos.roomName;
	            if(flag.room && _.get(Memory.rooms, [roomName, 'cluster']) == cluster.id){
	                let parts = flag.name.split('-');
	                let range = 0;
	                if(parts.length > 1){
	                    if(CONTROLLER_STRUCTURES[parts[1]]){
	                        range = 50;
	                        type = parts[1];
	                    }else if(parts[1] == 'all'){
	                        range = 50;
	                    }else{
	                        range = parseInt(parts[1]);
	                    }
	                }
	                let structures = _.filter(flag.pos.findInRange(FIND_STRUCTURES, range), structure => _.get(structure, 'hits', 0) > 0 && (!type || structure.structureType == type));
	                if(structures.length > 0){
	                    targets = targets.concat(structures);
	                }else{
	                    flag.remove();
	                }
	            }
	        }
	        return this.jobsForTargets(cluster, subtype, targets);
	    }

	    /// Creep ///

	    allocate(cluster, creep, opts){
	        return creep.getActiveBodyparts('work') * 50000;
	    }

	    calculateBid(cluster, creep, opts, job, distance){
	        return distance / 50;
	    }

	    process(cluster, creep, opts, job, target){
	        this.orMove(creep, target, creep.dismantle(target));
	    }

	}

	module.exports = DismantleWorker;

/***/ },
/* 19 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(14);

	class HealWorker extends BaseWorker {
	    constructor(){ super('heal', { quota: true }); }

	    /// Job ///

	    heal(cluster, subtype){
	        let healrooms = _.filter(cluster.rooms, room => room.memory.role != 'core' || _.get(room, 'controller.level', 0) < 3);
	        let targets = _.filter(cluster.findIn(healrooms, FIND_MY_CREEPS), creep => creep.hits < creep.hitsMax);
	        return this.jobsForTargets(cluster, subtype, targets);
	    }

	    jobValid(cluster, job){
	        return super.jobValid(cluster, job) && job.target.hits < job.target.hitsMax;
	    }

	    /// Creep ///

	    calculateBid(cluster, creep, opts, job, distance){
	        return distance / 50;
	    }

	    process(cluster, creep, opts, job, target){
	        let range = creep.pos.getRangeTo(target);
	        if(range > 1){
	            this.move(creep, target);
	            if(range <= 3){
	                creep.rangedHeal(target);
	            }
	        }else{
	            creep.heal(target);
	        }
	    }

	}

	module.exports = HealWorker;

/***/ },
/* 20 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(14);

	class IdleWorker extends BaseWorker {
	    constructor(){ super('idle', { priority: 99 }); }

	    /// Job ///
	    calculateCapacity(cluster, subtype, id, target, args){
	        return 8;
	    }

	    generateJobsForSubtype(cluster, subtype){
	        return this.jobsForTargets(cluster, subtype, cluster.structures[subtype]);
	    }

	    /// Creep ///

	    continueJob(cluster, creep, opts, job){
	        return super.continueJob(cluster, creep, opts, job) && !Game.interval(10);
	    }

	    calculateBid(cluster, creep, opts, job, distance){
	        return distance / 50;
	    }

	    process(cluster, creep, opts, job, target){
	        if(creep.pos.getRangeTo(target) > 2){
	            this.move(creep, target);
	        }
	    }

	}

	module.exports = IdleWorker;

/***/ },
/* 21 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(14);

	class KeepWorker extends BaseWorker {
	    constructor(){ super('keep', { ignoreRoads: true }); }

	    /// Job ///

	    keep(cluster, subtype){
	        if(cluster.maxRCL < 7){
	            return [];
	        }
	        let keeps = cluster.findIn(cluster.roomflags.keep, FIND_HOSTILE_STRUCTURES);
	        return this.jobsForTargets(cluster, subtype, _.reject(keeps, keep => keep.ticksToSpawn > 60));
	    }

	    jobValid(cluster, job){
	        return super.jobValid(cluster, job) && !(job.target.ticksToSpawn > 60 && job.target.ticksToSpawn < 280);
	    }

	    /// Creep ///

	    continueJob(cluster, creep, opts, job){
	        return super.continueJob(cluster, creep, opts, job);
	    }

	    canBid(cluster, creep, opts){
	        return creep.hits > creep.hitsMax * 0.8 && creep.ticksToLive > 25;
	    }

	    calculateBid(cluster, creep, opts, job, distance){
	        if(job.target.ticksToSpawn > creep.ticksToLive){
	            return false;
	        }
	        return (job.target.ticksToSpawn || 0) / 300 + distance / 500;
	    }

	    process(cluster, creep, opts, job, target){
	        let idleRange = target.ticksToSpawn < 10 ? 1 : 2;
	        let hostiles = creep.room.find(FIND_HOSTILE_CREEPS, { filter: target => creep.pos.getRangeTo(target) < 10 || _.get(target, 'owner.username', false) != 'Source Keeper' });
	        if(hostiles.length > 0){
	            var enemy = _.first(_.sortBy(hostiles, hostile => creep.pos.getRangeTo(hostile)));
	            if(creep.getActiveBodyparts(RANGED_ATTACK) > 0 && creep.pos.getRangeTo(enemy) <= 3){
	                creep.rangedAttack(enemy);
	            }
	            return this.orMove(creep, enemy, creep.attack(enemy)) == OK;
	        }else if(creep.pos.getRangeTo(target) > idleRange){
	            this.move(creep, target);
	        }else if(creep.pos.getRangeTo(target) < idleRange){
	            this.moveAway(creep, target, idleRange);
	        }
	    }

	}

	module.exports = KeepWorker;

/***/ },
/* 22 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(14);

	class MineWorker extends BaseWorker {
	    constructor(){ super('mine', { quota: ['energy', 'mineral'], critical: 'energy' }); }

	    /// Job ///

	    energy(cluster, subtype){
	        var sources = _.filter(cluster.findAll(FIND_SOURCES), source => source.room.memory.role != 'reserve');
	        return this.jobsForTargets(cluster, subtype, sources);
	    }

	    mineral(cluster, subtype){
	        var resources = Game.hegemony.resources;
	        var minerals = _.filter(cluster.findAll(FIND_MINERALS), mineral => mineral.mineralAmount > 0 && resources[mineral.mineralType].stored < 250000 && mineral.hasExtractor());
	        return this.jobsForTargets(cluster, subtype, minerals);
	    }

	    calculateCapacity(cluster, subtype, id, target, args){
	        return 6;
	    }

	    /// Creep ///

	    allocate(cluster, creep, opts){
	        return creep.getActiveBodyparts('work');
	    }

	    calculateBid(cluster, creep, opts, job, distance){
	        return distance / 50;
	    }

	    process(cluster, creep, opts, job, target){
	        if(creep.pos.getRangeTo(target) > 1){
	            this.move(creep, target);
	        }else{
	            creep.harvest(target);
	        }
	    }

	}

	module.exports = MineWorker;

/***/ },
/* 23 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(14);

	class ObserveWorker extends BaseWorker {
	    constructor(){ super('observe', { quota: true, critical: 'observe', ignoreRoads: true }); }

	    /// Job ///

	    genTarget(cluster, subtype, id, args){
	        if(id.indexOf('-') > 0){
	            let parts = id.split('-');
	            let pos = { pos: new RoomPosition(parseInt(parts[1]), parseInt(parts[2]), parts[0]), range: 15 };
	            return _.get(Game.rooms, [parts[0], 'controller'], pos);
	        }else{
	            return Game.getObjectById(id);
	        }
	    }

	    createId(cluster, subtype, target, args){
	        return target.pos.roomName + '-25-25';
	    }

	    observe(cluster, subtype){
	        let unobservedRooms = _.pick(Memory.observe || {}, timeout => timeout > Game.time);
	        const targets = _.reduce(Memory.rooms, (result, data, name)=>{
	            if(data.cluster == cluster.id && data.observe){
	                let targetRoom = Game.rooms[name];
	                if(targetRoom && targetRoom.controller && targetRoom.controller.my){
	                    delete Memory.rooms[name].observe;
	                }
	                let target;
	                if(!targetRoom || !targetRoom.controller){
	                    target = { pos: new RoomPosition(25, 25, name), range: 15 };
	                }else{
	                    target = targetRoom.controller;
	                }
	                if(!targetRoom && !unobservedRooms[name]){
	                    unobservedRooms[name] = Game.time + 200;
	                }
	                result.push(target);
	            }
	            return result;
	        }, []);
	        Memory.observe = unobservedRooms;
	        return this.jobsForTargets(cluster, subtype, targets);
	    }

	    /// Creep ///

	    continueJob(cluster, creep, opts, job){
	        if(opts.onlyReveal && Game.rooms[job.target.pos.roomName]){
	            return false;
	        }
	        return super.continueJob(cluster, creep, opts, job) && (!opts.onlyReveal || !job.target.id);
	    }

	    calculateBid(cluster, creep, opts, job, distance){
	        if(opts.onlyReveal && Game.rooms[job.target.pos.roomName]){
	            return false;
	        }
	        return distance / 50;
	    }

	    process(cluster, creep, opts, job, target){
	        if(creep.pos.getRangeTo(target) > (target.range || 3)){
	            this.move(creep, target);
	        }
	    }

	}

	module.exports = ObserveWorker;

/***/ },
/* 24 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(14);

	class PickupWorker extends BaseWorker {
	    constructor(){ super('pickup', { args: ['id', 'resource'], critical: 'pickup', quota: ['mineral'] }); }

	    /// Job ///
	    calculateCapacity(cluster, subtype, id, target, args){
	        return target.getResource(args.resource);
	    }

	    pickup(cluster, subtype){
	        var energy = cluster.findAll(FIND_DROPPED_ENERGY);
	        var storage = _.filter(cluster.getAllStructures([STRUCTURE_STORAGE, STRUCTURE_CONTAINER, STRUCTURE_LINK]), struct => struct.getResource(RESOURCE_ENERGY) > 0);
	        return this.jobsForTargets(cluster, subtype, energy.concat(storage), { resource: RESOURCE_ENERGY });
	    }

	    harvest(cluster, subtype){
	        var targets = _.reduce(cluster.roomflags.harvest, (result, room)=>{
	            var energy = cluster.find(room, FIND_DROPPED_ENERGY);
	            var containers = _.filter(cluster.getStructuresByType(room, STRUCTURE_CONTAINER), struct => struct.getResource(RESOURCE_ENERGY) > 0 && !struct.hasTag('stockpile'));
	            return result.concat(energy).concat(containers);
	        }, []);
	        return this.jobsForTargets(cluster, subtype, targets, { resource: RESOURCE_ENERGY });
	    }

	    mineral(cluster, subtype){
	        var containers = _.filter(cluster.getAllStructures([STRUCTURE_CONTAINER]), struct => struct.getStored() > struct.getResource(RESOURCE_ENERGY));
	        var jobs = [];
	        for(let store of containers){
	            _.forEach(store.getResourceList(), (amount, type)=>{
	                if(type != RESOURCE_ENERGY && amount > 0){
	                    jobs.push(this.createJob(cluster, subtype, store, { resource: type }));
	                }
	            });
	        }
	        return jobs;
	    }

	    /// Creep ///

	    allocate(cluster, creep, opts, job){
	        return creep.getAvailableCapacity();
	    }

	    jobValid(cluster, job){
	        return super.jobValid(cluster, job) && job.target.getResource(job.args.resource) > 0;
	    }

	    continueJob(cluster, creep, opts, job){
	        return super.continueJob(cluster, creep, opts, job) && creep.getAvailableCapacity() > 10;
	    }

	    canBid(cluster, creep, opts){
	        return creep.getAvailableCapacity() > 0;
	    }

	    calculateBid(cluster, creep, opts, job, distance){
	        if(job.target.id == creep.memory.lastDeliver){
	            return false;
	        }
	        return distance / 50 + Math.max(0, 1 - job.capacity / creep.carryCapacity);
	    }

	    process(cluster, creep, opts, job, target){
	        var result;
	        if(target.resourceType){
	            result = creep.pickup(target);
	        }else{
	            result = creep.withdraw(target, job.args.resource);
	        }
	        if(result == ERR_NOT_IN_RANGE){
	            this.move(creep, target);
	        }
	    }

	}

	module.exports = PickupWorker;

/***/ },
/* 25 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(14);

	class RepairWorker extends BaseWorker {
	    constructor(){ super('repair', { requiresEnergy: true, quota: true, range: 3 }); }

	    /// Job ///
	    calculateCapacity(cluster, subtype, id, target, args){
	        return target.getDamage();
	    }

	    repair(cluster, subtype){
	        let targets = _.filter(cluster.findAll(FIND_STRUCTURES), struct => struct.hits < struct.getMaxHits());
	        return this.jobsForTargets(cluster, subtype, targets);
	    }

	    jobValid(cluster, job){
	        return super.jobValid(cluster, job) && job.target.getDamage() > 0;
	    }

	    /// Creep ///

	    allocate(cluster, creep, opts){
	        return creep.getResource(RESOURCE_ENERGY) * 100;
	    }

	    calculateBid(cluster, creep, opts, job, distance){
	        if(cluster.tags.ignorerepair && job.target.hasTag('ignorerepair')){
	            return false;
	        }
	        return job.target.hits / (job.target.getMaxHits() * 4) + (1 - creep.carry.energy / creep.carryCapacity);
	    }

	    process(cluster, creep, opts, job, target){
	        return this.orMove(creep, target, creep.repair(target)) == OK;
	    }

	}

	module.exports = RepairWorker;

/***/ },
/* 26 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(14);

	class ReserveWorker extends BaseWorker {
	    constructor(){ super('reserve', { quota: true }); }

	    /// Job ///

	    reserve(cluster, subtype){
	        var controllers = _.map(_.filter(cluster.roomflags.reserve, room => _.get(room, 'controller.reservation.ticksToEnd', 0) < 3000 && room.controller), 'controller');
	        return this.jobsForTargets(cluster, subtype, controllers);
	    }

	    calculateCapacity(cluster, subtype, id, target, args){
	        return 2;
	    }

	    /// Creep ///

	    continueJob(cluster, creep, opts, job){
	        if(job.target && job.target.my){
	            delete job.target.room.memory.reserve;
	            return false;
	        }
	        return super.continueJob(cluster, creep, opts, job) && _.get(job, 'target.reservation.ticksToEnd', 0) < 4800;
	    }

	    keepDeadJob(cluster, creep, opts, job){
	        return job.subtype == 'reserve' && job.target && !job.target.my;
	    }

	    allocate(cluster, creep, opts){
	        return creep.getActiveBodyparts('claim');
	    }

	    calculateBid(cluster, creep, opts, job, distance){
	        if(job.target && job.target.my){
	            delete job.target.room.memory.reserve;
	            return false;
	        }
	        return _.get(job, 'target.reservation.ticksToEnd', 0) / 5000;
	    }

	    process(cluster, creep, opts, job, target){
	        if(Game.interval(5) && target.room.memory.claim && creep.pos.getRangeTo(target) <= 1){
	            let result = creep.claimController(target);
	            if(result == OK){
	                console.log('Claimed room', target.pos.roomName, 'for cluster', cluster.id);
	                delete Memory.rooms[target.pos.roomName].observe;
	                delete Memory.rooms[target.pos.roomName].claim;
	                delete Memory.rooms[target.pos.roomName].reserve;
	                cluster.changeRole(target.pos.roomName, 'core');
	            }else{
	                console.log('Could not claim room', target.pos.roomName, 'for cluster', cluster.id, '! result:', result);
	            }
	        }
	        this.orMove(creep, target, creep.reserveController(target));
	    }

	}

	module.exports = ReserveWorker;

/***/ },
/* 27 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(14);
	const Util = __webpack_require__(11);

	class TransferWorker extends BaseWorker {
	    constructor(){ super('transfer', { args: ['id', 'action', 'resource', 'amount'], quota: true }); }

	    generateEnergyTransfers(cluster, type, need){
	        return cluster.structures[type].reduce((result, struct) => {
	            let energy = struct.getResource(RESOURCE_ENERGY);
	            if(energy < need - 200){
	                result.push(this.createJob(cluster, 'transfer', struct, { action: 'deliver', resource: RESOURCE_ENERGY, amount: need }));
	            }
	            return result;
	        }, []);
	    }

	    generateTerminalTransfers(cluster){
	        var targetAmount = 5000 * _.size(cluster.structures.terminal) + 5000;
	        return _.reduce(cluster.resources, (result, data, type)=>{
	            if(type != RESOURCE_ENERGY && data.totals.terminal < targetAmount && data.totals.storage > 0){
	                var storage = _.first(data.storage);
	                result.push(this.createJob(cluster, 'transfer', storage, { action: 'terminal', resource: type, amount: targetAmount }));
	            }
	            return result;
	        }, []);
	    }

	    generateLabTransfers(cluster){
	        var min = 1500;
	        var max = 2500;
	        return _.reduce(cluster.transfer, (result, resource, labId) => {
	            var target = Game.structures[labId];
	            if(!target){
	                console.log('invalid lab', labId);
	                delete cluster.transfer[labId];
	                return result;
	            }
	            if(resource && resource.startsWith('store')){
	                var parts = resource.split('-');
	                var wrongType = target.mineralType && target.mineralType != parts[1];
	                if(wrongType || target.mineralAmount >= 500){
	                    result.push(this.createJob(cluster, 'transfer', target, { action: 'store', resource: target.mineralType, amount: 0 }));
	                }
	                return result;
	            }
	            if(target.mineralType && target.mineralType != resource){
	                result.push(this.createJob(cluster, 'transfer', target, { action: 'store', resource: target.mineralType, amount: 0 }));
	                return result;
	            }
	            if(resource){
	                var amount = target.getResource(resource);
	                if(amount < min && cluster.resources[resource].stored > 0){
	                    result.push(this.createJob(cluster, 'transfer', target, { action: 'deliver', resource, amount: 2000 }));
	                }
	                if(amount > max){
	                    result.push(this.createJob(cluster, 'transfer', target, { action: 'store', resource, amount: 2000 }));
	                }
	            }
	            return result;
	        }, []);
	    }

	    /// Job ///

	    transfer(cluster, subtype){
	        let jobLists = [];
	        jobLists.push(this.generateEnergyTransfers(cluster, STRUCTURE_LAB, 2000));
	        jobLists.push(this.generateEnergyTransfers(cluster, STRUCTURE_TERMINAL, 50000));
	        jobLists.push(this.generateEnergyTransfers(cluster, STRUCTURE_NUKER, 300000));
	        jobLists.push(this.generateLabTransfers(cluster));
	        if(cluster.structures.terminal.length > 0){
	            jobLists.push(this.generateTerminalTransfers(cluster));
	        }
	        return _.flatten(jobLists);
	    }

	    jobValid(cluster, job){
	        if(!super.jobValid(cluster, job)){
	            return false;
	        }
	        var resourceData = cluster.getResources();
	        var resource = job.args.resource;
	        var data = resourceData[resource];
	        var targetResources = job.target.getResource(resource);
	        if(job.args.action == 'store'){
	            return targetResources > job.args.amount;
	        }else if(job.args.action == 'deliver'){
	            return targetResources < job.args.amount && data.stored > 0;
	        }else if(job.args.action == 'terminal'){
	            return data.globals.terminal < job.args.amount && data.totals.storage > 0;
	        }
	    }

	    validate(cluster, creep, opts, target, job){
	        var resource = job.args.resource;
	        var currentResources = creep.getResource(resource);
	        var targetResources = job.target.getResource(resource);
	        var resourceData = cluster.getResources();
	        var data = resourceData[resource];
	        var allStored = data.stored;
	        var stored = data.totals.storage;
	        var terminalStored = data.totals.terminal;
	        if(job.args.action == 'store'){
	            if(currentResources > 0){
	                return true;
	            }else{
	                return targetResources > job.amount;
	            }
	        }else if(job.args.action == 'deliver'){
	            if(currentResources > 0){
	                return targetResources < job.amount;
	            }else{
	                return targetResources < job.amount && allStored > 0;
	            }
	        }else if(job.args.action == 'terminal'){
	            if(currentResources > 0){
	                return terminalStored < job.amount;
	            }else{
	                return terminalStored < job.amount && stored > 0;
	            }
	        }
	        console.log('invalid type', job.id, creep, job.args.action);
	        return false;
	    }

	    /// Creep ///

	    // continueJob(cluster, creep, opts, job){
	    //     return super.continueJob(cluster, creep, opts, job);
	    // }

	    canBid(cluster, creep, opts){
	        return creep.ticksToLive > 100;
	    }

	    keepDeadJob(cluster, creep, opts, job){
	        var resource = job.args.resource;
	        var current = creep.getResource(resource);
	        if(job.args.action == 'store' || job.args.action == 'terminal'){
	            return current > 0;
	        }else if(job.args.action == 'deliver'){
	            return current > 0 && job.target.getResource(resource) < job.args.amount;
	        }
	    }

	    calculateBid(cluster, creep, opts, job, distance){
	        if(creep.getStored() > 0 && creep.getResource(job.args.resource) == 0){
	            return false;
	        }
	        return distance / 50;
	    }

	    start(cluster, creep, opts, job){
	        super.start(cluster, creep, opts, job);
	        creep.memory.transferPickup = false;
	        creep.memory.transferDeliver = false;
	    }

	    process(cluster, creep, opts, job, target){
	        var type = job.args.resource;
	        var action = job.args.action;
	        var deliver = false;
	        var pickup = false;
	        var target = false;
	        var resources = creep.getResource(type);
	        if(resources > 0){
	            creep.memory.transferPickup = false;
	            deliver = this.getDeliver(cluster, creep, job, resources, action);
	            target = deliver.target;
	        }else{
	            creep.memory.transferDeliver = false;
	            pickup = this.getPickup(cluster, creep, job, action);
	            target = pickup.target;
	        }
	        if(target && creep.pos.getRangeTo(target) > 1){
	            this.move(creep, target);
	        }else if(deliver){
	            creep.transfer(deliver.target, type, deliver.amount);
	        }else if(pickup){
	            creep.withdraw(pickup.target, type, Math.min(creep.getCapacity() - creep.getStored(), pickup.amount));
	        }
	    }
	    
	    end(cluster, creep, opts, job){
	        super.end(cluster, creep, opts, job);
	        creep.memory.transferPickup = false;
	        creep.memory.transferDeliver = false;
	    }

	    getPickup(cluster, creep, job, action){
	        let type = job.args.resource;
	        if(creep.memory.transferPickup){
	            var target = Game.getObjectById(creep.memory.transferPickup);
	            if(target && target.getResource(type) > 0){
	                return {
	                    target,
	                    amount: Math.min(target.getResource(type), Math.max(0, job.args.amount - job.target.getResource(type)))
	                };
	            }
	        }
	        var data = cluster.resources[type];
	        var target;
	        if(action == 'store'){
	            target = job.target;
	        }else if(action == 'terminal'){
	            target = _.first(Util.sort.closest(creep, data.storage));
	        }else if(action == 'deliver'){
	            target = _.first(Util.sort.closest(creep, data.sources));
	        }
	        if(target && target.getResource(type) > 0){
	            creep.memory.transferPickup = target.id;
	            return {
	                target,
	                amount: Math.min(target.getResource(type), Math.max(0, job.args.amount - job.target.getResource(type)))
	            };
	        }
	        //DEBUG
	        console.log('could not generate pickup target', creep, job.id, action, type);
	        return false;
	    }
	    
	    getDeliver(cluster, creep, job, resources, action){
	        let type = job.args.resource;
	        var deliverAmount = this.getDeliverAmount(job, resources);
	        if(creep.memory.transferDeliver){
	            var target = Game.getObjectById(creep.memory.transferDeliver);
	            if(target){
	                return {
	                    target,
	                    amount: deliverAmount
	                };
	            }
	        }
	        var target;
	        if(action == 'store'){
	            var terminalIdeal = 5000 * _.size(cluster.structures.terminal);
	            if(cluster.resources[type].totals.terminal + resources <= terminalIdeal + 10000){
	                target = _.first(Util.sort.closest(creep, cluster.structures.terminal));
	            }else{
	                target = _.first(Util.sort.closest(creep, cluster.structures.storage));
	            }
	        }else if(action == 'terminal'){
	            target = _.first(Util.sort.closest(creep, cluster.structures.terminal));
	        }else{
	            target = job.target;
	        }
	        if(target){
	            creep.memory.transferDeliver = target.id;
	            return {
	                target,
	                amount: deliverAmount
	            };
	        }
	        //DEBUG
	        console.log('could not generate delivery target', creep, job.id, resources);
	        return false;
	    }

	    getDeliverAmount(job, resources){
	        if(job.args.action == 'store'){
	            return resources;
	        }
	        return Math.min(resources, Math.max(0, job.args.amount - job.target.getResource(job.args.resource)));
	    }

	}

	module.exports = TransferWorker;

/***/ },
/* 28 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(14);

	class UpgradeWorker extends BaseWorker {
	    constructor(){ super('upgrade', { requiresEnergy: true, quota: true, range: 3 }); }

	    /// Job ///
	    calculateCapacity(cluster, subtype, id, target, args){
	        if(cluster.totalEnergy < 2000){
	            return 5;
	        }
	        if(target.level == 8){
	            return 15;
	        }
	        if(cluster.maxRCL <= 2){
	            return 5;
	        }
	        if(cluster.maxRCL < 4){
	            return 10;
	        }
	        let energy = _.get(target, 'room.storage.store.energy', 0);
	        return Math.max(1, Math.floor(energy / 150000)) * 15;
	    }

	    upgrade(cluster, subtype){
	        return this.jobsForTargets(cluster, subtype, _.map(cluster.getRoomsByRole('core'), 'controller'));
	    }

	    /// Creep ///

	    allocate(cluster, creep, opts){
	        return creep.getActiveBodyparts('work');
	    }

	    calculateBid(cluster, creep, opts, job, distance){
	        return distance / 50 + (1 - creep.carry.energy / creep.carryCapacity);
	    }

	    process(cluster, creep, opts, job, target){
	        this.orMove(creep, target, creep.upgradeController(target));
	    }

	}

	module.exports = UpgradeWorker;

/***/ },
/* 29 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var Avoid = __webpack_require__(30);
	var Boost = __webpack_require__(32);
	var Defend = __webpack_require__(33);
	var Energy = __webpack_require__(34);
	var MinecartAction = __webpack_require__(35);
	var Repair = __webpack_require__(36);
	var SelfHeal = __webpack_require__(37);

	module.exports = function(){
	    return {
	        avoid: new Avoid(),
	        boost: new Boost(),
	        defend: new Defend(),
	        energy: new Energy(),
	        minecart: new MinecartAction(),
	        repair: new Repair(),
	        selfheal: new SelfHeal()
	    };
	};

/***/ },
/* 30 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(31);

	class AvoidAction extends BaseAction {
	    constructor(){
	        super('avoid');
	        this.range = 6;
	    }

	    shouldBlock(cluster, creep, opts){
	        var idle = false;
	        var hostiles = cluster.find(creep.room, FIND_HOSTILE_CREEPS);
	        if(creep.room.memory.keep){
	            let keeps = _.filter(cluster.find(creep.room, FIND_HOSTILE_STRUCTURES), keep => keep.ticksToSpawn < 10);
	            if(keeps.length > 0){
	                hostiles = hostiles.concat(keeps);
	            }
	        }
	        if(hostiles.length > 0){
	            let avoidTargets = [];
	            for(var enemy of hostiles){
	                let distance = creep.pos.getRangeTo(enemy);
	                if(distance == this.range){
	                    idle = true;
	                }else if(distance < this.range){
	                    avoidTargets.push({ pos: enemy.pos, range: this.range + 2, enemy });
	                }
	            }
	            if(avoidTargets.length > 0){
	                return { type: this.type, data: avoidTargets };
	            }else if(idle && !Game.interval(5)){
	                return { type: this.type, data: 'idle' };
	            }
	        }
	        return false;
	    }

	    blocked(cluster, creep, opts, block){
	        if(block != 'idle'){
	            var result = PathFinder.search(creep.pos, block, { flee: true });
	            creep.moveByPath(result.path);
	        }
	    }

	}


	module.exports = AvoidAction;

/***/ },
/* 31 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var Pathing = __webpack_require__(2);

	class BaseAction {
	    constructor(type){
	        this.type = type;
	    }

	    preWork(cluster, creep, opts){}

	    shouldBlock(cluster, creep, opts){
	        return false;
	    }

	    postWork(cluster, creep, opts, action){}

	    blocked(cluster, creep, opts, block){
	        console.log('block not implemented!', this);
	    }

	    move(creep, target){
	        return Pathing.moveCreep(creep, target, 1, false);
	    }

	    orMove(creep, target, result){
	        if(result == ERR_NOT_IN_RANGE){
	            this.move(creep, target);
	        }
	        return result;
	    }

	}

	module.exports = BaseAction;

/***/ },
/* 32 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(31);
	var Util = __webpack_require__(11);

	class BoostAction extends BaseAction {
	    constructor(){
	        super('boost');
	    }

	    shouldBlock(cluster, creep, opts){
	        if(creep.memory.calculateBoost){
	            creep.memory.boosted = _.countBy(_.filter(creep.body, 'boost'), 'boost');
	            delete creep.memory.calculateBoost;
	        }
	        if(creep.memory.boost){
	            return { type: this.type, data: creep.memory.boost }
	        }
	        return false;
	    }

	    blocked(cluster, creep, opts, block){
	        var type = _.first(_.keys(creep.memory.boost));
	        var resource = Game.boosts[type];
	        var needed = creep.memory.boost[type];

	        if(!creep.memory.boostlab){
	            var available = cluster.boostMinerals[resource];
	            if(available > 30 * needed){
	                var boostLabs = _.invert(cluster.boost);
	                creep.memory.boostlab = boostLabs[type];
	            }
	            if(!BoostAction.validateLab(creep.memory.boostlab, resource, needed)){
	                console.log(cluster.id, 'Insufficient resources to boost', creep.name, resource, type);
	                this.remove(cluster, creep, resource);
	            }
	        }

	        if(creep.memory.boostlab){
	            var lab = Game.getObjectById(creep.memory.boostlab);
	            if(lab && lab.mineralType == resource && lab.mineralAmount >= needed * 30){
	                if(creep.pos.getRangeTo(lab) > 1){
	                    this.move(creep, lab);
	                }else if(lab.boostCreep(creep) == OK){
	                    this.remove(cluster, creep, type);
	                }else{
	                    Game.notify(cluster.id + ' - Unknown issue boosting ' + creep.name + ' - ' + resource + ' - ' + lab);
	                    this.remove(cluster, creep, type);
	                }
	            }else{
	                delete creep.memory.boostlab;
	            }
	        }
	    }

	    static validateLab(labId, resource, partCount){
	        var lab = Game.getObjectById(labId);
	        return lab && lab.mineralType == resource && lab.mineralAmount >= partCount * 30;
	    }

	    remove(cluster, creep, type){
	        delete creep.memory.boostlab;
	        if(_.size(creep.memory.boost) > 1){
	            delete creep.memory.boost[type];
	        }else{
	            delete creep.memory.boost;
	        }
	        creep.memory.calculateBoost = true;
	    }
	}


	module.exports = BoostAction;

/***/ },
/* 33 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(31);
	var Util = __webpack_require__(11);

	var range = 5;

	class DefendAction extends BaseAction {
	    constructor(){
	        super('defend');
	    }

	    shouldBlock(cluster, creep, opts){
	        var hostiles = cluster.find(creep.room, FIND_HOSTILE_CREEPS);
	        if(hostiles.length > 0){
	            var targets = _.filter(hostiles, hostile => creep.pos.getRangeTo(hostile) < range && (hostile.getActiveBodyparts(ATTACK) > 0 || hostile.getActiveBodyparts(RANGED_ATTACK) > 0))
	            var target = _.first(Util.sort.closest(targets));
	            if(target){
	                return { type: this.type, data: target };
	            }
	        }
	        return false;
	    }

	    blocked(cluster, creep, opts, block){
	        this.orMove(creep, block, creep.attack(block));
	        if(creep.pos.getRangeTo(block) <= 3 && creep.getActiveBodyparts(RANGED_ATTACK) > 0){
	            creep.rangedAttack(block);
	        }
	    }

	}


	module.exports = DefendAction;

/***/ },
/* 34 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(31);

	var offsets = {
	    container: -1,
	    storage: -1.25,
	    link: -1.5,
	};

	class EnergyAction extends BaseAction {
	    constructor(){
	        super('energy');
	    }

	    postWork(cluster, creep, opts, action){
	        var storage = creep.getStored();
	        if(storage < creep.carryCapacity * 0.25){
	            // var energy = this.catalog.lookForArea(creep.room, creep.pos, LOOK_ENERGY, 2);
	            var containers = creep.room.lookForRadius(creep.pos, LOOK_STRUCTURES, 2);
	            var targets = _.filter(containers, struct => (struct.structureType == STRUCTURE_CONTAINER || struct.structureType == STRUCTURE_STORAGE || struct.structureType == STRUCTURE_LINK) && struct.getResource(RESOURCE_ENERGY) > 0);
	            var nearby = _.first(_.sortBy(targets, target => offsets[target.structureType] * Math.min(creep.carryCapacity, target.getResource(RESOURCE_ENERGY))));
	            if(nearby){
	                creep.withdraw(nearby, RESOURCE_ENERGY, Math.min(creep.getCapacity() - storage, nearby.getResource(RESOURCE_ENERGY)));
	            }
	        }
	    }
	}


	module.exports = EnergyAction;

/***/ },
/* 35 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(31);

	var offsets = {
	    container: 0.5,
	    storage: 0.25,
	    link: 0,
	    tower: -1
	};

	class MinecartAction extends BaseAction {
	    constructor(){
	        super('minecart');
	    }

	    postWork(cluster, creep, opts, action){
	        if(_.sum(creep.carry) >= creep.carryCapacity * 0.7){
	            var containers = creep.room.lookForRadius(creep.pos, LOOK_STRUCTURES, 2);
	            var targets = _.filter(containers, struct => (struct.structureType == STRUCTURE_CONTAINER || struct.structureType == STRUCTURE_STORAGE || struct.structureType == STRUCTURE_LINK || struct.structureType == STRUCTURE_TOWER) && struct.getAvailableCapacity() > 0);
	            var nearby = _.sortBy(targets, target => offsets[target.structureType] + Math.max(1, creep.pos.getRangeTo(target)));
	            if(nearby.length > 0){
	                if(creep.pos.getRangeTo(nearby[0]) > 1){
	                    creep.moveTo(nearby[0]);
	                }else{
	                    _.forEach(creep.carry, (amount, type)=>{
	                        if(amount > 0){
	                            creep.transfer(nearby[0], type);
	                        }
	                    });
	                }
	            }
	        }
	    }
	}


	module.exports = MinecartAction;

/***/ },
/* 36 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(31);

	class RepairAction extends BaseAction {
	    constructor(){
	        super('repair');
	    }

	    postWork(cluster, creep, opts, action){
	        if(!action && creep.carry.energy > creep.carryCapacity / 8){
	            var structures = creep.room.lookForRadius(creep.pos, LOOK_STRUCTURES, 3);
	            var targets = _.filter(structures, structure => structure.hits < structure.getMaxHits() && structure.mine());
	            if(targets.length > 0){
	                creep.repair(targets[0]);
	            }
	        }
	    }
	}


	module.exports = RepairAction;

/***/ },
/* 37 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(31);

	class SelfHealAction extends BaseAction {
	    constructor(){
	        super('selfheal');
	    }

	    shouldBlock(cluster, creep, opts){
	        if(opts.block && creep.hits < creep.hitsMax - opts.block){
	            return { type: this.type, data: true };
	        }
	        return false;
	    }

	    postWork(cluster, creep, opts, action){
	        if(!action && creep.hits < creep.hitsMax){
	            creep.heal(creep);
	        }
	    }

	    blocked(cluster, creep, opts, block){
	        if(creep.hits < creep.hitsMax){
	            creep.heal(creep);
	        }
	    }

	}


	module.exports = SelfHealAction;

/***/ },
/* 38 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var Util = __webpack_require__(11);

	var DEFICIT_START_MIN = 750;
	var DEFICIT_END_MIN = 0;
	var CAPACITY_END_MIN = 100;

	class Production {
	    constructor(){}

	    process(cluster){
	        if(Game.interval(500)){
	            cluster.structures.lab.filter(lab => !lab.hasTag('production') && !lab.hasTag('boost'))
	                                  .forEach(lab => lab.addTag('production'));
	        }
	        if(!Game.interval(25)){
	            return;
	        }
	        var resources = cluster.getResources();
	        var targetAmount = _.size(cluster.structures.terminal) * 5000 + 1000;
	        var resourceList = _.values(REACTIONS.X);//_.filter(, val => val != 'XUHO2');
	        var quota = _.zipObject(resourceList, _.map(resourceList, type => targetAmount));
	        quota.G = targetAmount;
	        quota.UO = targetAmount;

	        var reactions = {};
	        _.forEach(quota, (amount, type) => {
	            this.generateReactions(type, amount - resources[type].total, reactions, true, resources);
	        });

	        Memory.stats.reaction = _.sum(_.map(reactions, reaction => Math.max(0, reaction.deficit)));

	        for(let type in cluster.reaction){
	            let deficit = _.get(reactions, [type, 'deficit'], 0);
	            let capacity = _.get(reactions, [type, 'capacity'], 0);
	            if(deficit <= DEFICIT_END_MIN || capacity < CAPACITY_END_MIN){
	                console.log(cluster.id, 'Ending reaction:', type, '-', deficit, 'of', capacity);
	                delete cluster.reaction[type];
	            }else{
	                this.updateReaction(type, cluster.reaction[type], reactions[type]);
	            }
	        }


	        var freeLabs = this.countFreeLabs(cluster);
	        var runnableReactions = _.filter(reactions, (reaction, type) => reaction.capacity > DEFICIT_START_MIN && reaction.deficit > DEFICIT_START_MIN && !cluster.reaction[type]);
	        var sortedReactions = _.sortBy(runnableReactions, (reaction) => -Math.min(reaction.deficit, reaction.capacity));

	        if(freeLabs.length > 0){
	            for(let reaction of sortedReactions){
	                if(freeLabs.length > 0){
	                    console.log(cluster.id, 'Starting reaction:', reaction.type, '-', reaction.deficit, 'of', reaction.capacity);
	                    this.startReaction(cluster, reaction.type, reaction, freeLabs);
	                    freeLabs = this.countFreeLabs(cluster);
	                }
	            }
	        }
	        this.updateLabTransfers(cluster);
	    }

	    countFreeLabs(cluster){
	        return _.difference(_.keys(cluster.labs), _.map(cluster.reaction, 'lab'));
	    }

	    updateLabTransfers(cluster){
	        _.forEach(cluster.labs, labSet => _.forEach(labSet, (labId, ix)=>{
	            cluster.transfer[labId] = false;
	        }));
	        _.forEach(cluster.reaction, (reaction, type)=>{
	            var labs = cluster.labs[reaction.lab];
	            _.forEach(labs, (labId, ix)=>{
	                if(ix < reaction.components.length){
	                    cluster.transfer[labId] = reaction.components[ix];
	                }else{
	                    cluster.transfer[labId] = 'store-'+type;
	                }
	            });
	        });
	        _.forEach(cluster.boost, (boost, labId)=>{
	            cluster.transfer[labId] = Game.boosts[boost];
	        });
	    }

	    startReaction(cluster, type, reaction, freeLabs){
	        reaction.lab = _.first(freeLabs);
	        cluster.reaction[type] = reaction;
	    }

	    updateReaction(type, reaction, updated){
	        reaction.deficit = updated.deficit;
	        reaction.capacity = updated.capacity;
	        reaction.current = updated.current;
	    }

	    generateReactions(type, deficit, output, topLevel, resources){
	        if(type.length == 1 && (!topLevel || type != 'G')){
	            return;
	        }
	        var components = this.findReaction(type);
	        var inventory = _.map(components, component => resources[component].total);
	        _.forEach(inventory, (amount, ix) =>  this.generateReactions(components[ix], deficit - amount, output, false, resources));

	        if(output[type]){
	            output[type].deficit += deficit;
	        }else{
	            output[type] = { type, components, deficit, capacity: _.min(inventory), current: resources[type].total };
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