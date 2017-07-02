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

	var Federation = __webpack_require__(8);
	var AutoBuilder = __webpack_require__(11);
	var Cluster = __webpack_require__(4);
	var Controller = __webpack_require__(12);
	var Spawner = __webpack_require__(6);
	var Worker = __webpack_require__(13);
	var Production = __webpack_require__(41);
	var Pathing = __webpack_require__(2);

	var REPAIR_CAP = 10000000;

	module.exports.loop = function () {
	    //// Startup ////
	    PathFinder.use(true);
	    Poly();
	    Game.federation = new Federation();
	    Startup.start();
	    
	    for(var name in Memory.creeps) {
	        if(!Game.creeps[name]) {
	            delete Memory.creeps[name];
	        }
	    }
	    Game.profile('memory', Game.cpu.getUsed());
	    Cluster.init();
	    
	    if(Game.interval(100)){
	        _.forEach(Game.clusters, cluster =>cluster.processStats());
	    }
	    if(Game.interval(5000)){
	        _.forEach(Game.clusters, cluster => cluster.processLongterm());
	    }

	    Startup.processActions();

	    const allocated = {};

	    Game.matrix.startup();

	    //// Process ////

	    let bootstrap = false;
	    let bootstrapper = false;
	    if(Memory.bootstrap || Game.flags.bootstrap){
	        if(Memory.bootstrap){
	            bootstrap = Game.clusters[Memory.bootstrap];
	        }
	        if(!bootstrap && Game.flags.bootstrap && Game.flags.bootstrap.room){
	            bootstrap = Game.flags.bootstrap.room.cluster;
	        }
	        if(bootstrap && Game.flags.bootstrapper){
	            bootstrapper = Game.flags.bootstrapper.room.cluster;
	        }
	    }

	    let initTime = Game.cpu.getUsed();
	    Game.profileAdd('autobuy', 0);

	    let ix = 50;
	    let autobuildOffset = 1000;
	    for(let name in Game.clusters){
	        try{
	            let clusterStart = Game.cpu.getUsed();
	            let cluster = Game.clusters[name];
	            cluster.longtermAdd('spawn', 0);
	            cluster.longtermAdd('transfer', 0);

	            Game.matrix.process(cluster);

	            Worker.process(cluster);
	            
	            let spawnStart = Game.cpu.getUsed();
	            if(Game.interval(5) && Spawner.hasFreeSpawn(cluster)){
	                let spawnlist = Spawner.generateSpawnList(cluster, cluster);
	                if(!Spawner.processSpawnlist(cluster, spawnlist, cluster) && bootstrap && bootstrapper && bootstrapper.id == cluster.id && cluster.totalEnergy > 5000){
	                    spawnlist = Spawner.generateSpawnList(cluster, bootstrap);
	                    Spawner.processSpawnlist(cluster, spawnlist, bootstrap);
	                }
	            }
	            Game.profileAdd('spawncpu', Game.cpu.getUsed() - spawnStart);

	            Controller.control(cluster, allocated);

	            let iy = 1;
	            for(let buildRoom of cluster.roomflags.autobuild){
	                if(Game.intervalOffset(autobuildOffset, ix + iy)){
	                    let builder = new AutoBuilder(buildRoom);
	                    builder.buildTerrain();
	                    builder.autobuild(builder.generateBuildingList());
	                }
	                iy++;
	            }

	            if(Game.interval(100) && _.get(cluster, 'work.repair.damage.heavy', Infinity) < 350000 && cluster.totalEnergy > 400000 * cluster.structures.storage.length && cluster.opts.repair < REPAIR_CAP){
	                cluster.opts.repair += 50000;
	                // Game.notify('Increasing repair target in ' + cluster.id + ' to ' + cluster.opts.repair);
	                console.log('Increasing repair target in ' + cluster.id + ' to ' + cluster.opts.repair);
	            }

	            cluster.profile('cpu', Game.cpu.getUsed() - clusterStart);
	            ix+= 100;
	        }catch(e){
	            console.log(name, e);
	            Game.notify(name + ' - ' + e.toString());
	            throw e;
	        }
	    }
	    
	    let clusterEndTime = Game.cpu.getUsed();

	    try{
	        Production.process();
	        Controller.federation(allocated);
	    }catch(e){
	        console.log('federation', e);
	        Game.notify('federation: ' + e.toString());
	        throw e;
	    }

	    AutoBuilder.processRoadFlags();



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
	    _.forEach(Game.clusters, cluster => cluster.finishProfile());
	    Game.finishProfile();    

	    Game.profile('external', initTime + Game.cpu.getUsed() - clusterEndTime);
	    Game.profile('clusters', clusterEndTime - initTime);

	    if(Game.cpu.bucket < 5000){
	        Game.note('cpubucket', 'CPU bucket under limit! '+Game.cpu.bucket);
	    }
	    if(Game.cpu.bucket < 600){
	        Game.note('cpubucketcrit', 'CPU bucket critical! '+Game.cpu.bucket);
	    }
	    Memory.stats.bucket = Game.cpu.bucket;
	    Memory.stats.clusters = {};
	    _.forEach(Game.clusters, cluster => {
	        Memory.stats.clusters[cluster.id] = _.assign({}, cluster.longstats, cluster.stats);
	    });
	    Memory.stats.tick = Game.time;
	    Memory.stats.tickmod = Game.time % 100;
	    // Memory.stats.types = _.mapValues(_.groupBy(Game.creeps, 'memory.type'), list => list.length);
	    Memory.stats.gcl = Game.gcl.level + Game.gcl.progress / Game.gcl.progressTotal;
	    var cpu = Game.cpu.getUsed();
	    Game.profile('cpu', cpu);
	    Memory.stats.cpu = cpu;
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
	    var flagData = {};
	    Flag._flagPrefixes = false;
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
	        if(_.get(Memory, ['notify', type], 0) < Game.time){
	            console.log(message);
	            Game.notify(message);
	            _.set(Memory, ['notify', type], Game.time + 1000);
	        }
	    };

	    Game.owned = function owned(entity){
	        return entity.my || !entity.owner;
	    };

	    RoomObject.prototype.mine = function(){
	        return this.my || !this.owner;
	    }

	    Game.boosts = boostTypes;

	    Game.clusterForRoom = function clusterForRoom(roomName){
	        var roomMemory = Memory.rooms[roomName];
	        return roomMemory ? Game.clusters[roomMemory.cluster] : undefined;
	    };

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
	    /// Flag Helpers
	    ///

	    Flag.getByPrefix = function getByPrefix(prefix){
	        var data = flagData[prefix];
	        if(!data){
	            data = _.filter(Game.flags, flag => flag.name.startsWith(prefix));
	            flagData[prefix] = data;
	        }
	        return data;
	    }

	    Flag.prototype.getStructure = function(){
	        return _.first(_.filter(this.pos.lookFor(LOOK_STRUCTURES), struct => struct.structureType != STRUCTURE_ROAD));
	    }

	    if(!Flag.prototype.hasOwnProperty('parts')){
	        Object.defineProperty(Flag.prototype, 'parts', {
	            enumerable: false,
	            configurable: true,
	            get: function(){
	                if(!this._parts){
	                    this._parts = this.name.split('-');
	                }
	                return this._parts;
	            }
	        });
	    }

	    if(!Flag.hasOwnProperty('prefix')){
	        Object.defineProperty(Flag, 'prefix', {
	            enumerable: false,
	            configurable: true,
	            get: function(){
	                if(!Flag._flagPrefixes){
	                    Flag._flagPrefixes = _.groupBy(Game.flags, flag => flag.parts[0]);
	                }
	                return Flag._flagPrefixes;
	            }
	        });
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

	    if(!Room.prototype.hasOwnProperty('flags')){
	        Object.defineProperty(Room.prototype, 'flags', {
	            enumerable: false,
	            configurable: true,
	            get: function(){
	                return Game.federation.roomflags[this.name] || [];
	            }
	        });
	    }

	    if(!Room.prototype.hasOwnProperty('matrix')){
	        Object.defineProperty(Room.prototype, 'matrix', {
	            enumerable: false,
	            configurable: true,
	            get: function(){
	                return Game.matrix.rooms[this.name];
	            }
	        });
	    }

	    if(!Room.prototype.hasOwnProperty('hostile')){
	        Object.defineProperty(Room.prototype, 'hostile', {
	            enumerable: false,
	            configurable: true,
	            get: function(){
	                return this.controller && this.controller.owner && !this.controller.my;
	            }
	        });
	    }

	    Room.prototype.getFlagsByPrefix = function(prefix){
	        return _.filter(this.flags, flag => flag.name.startsWith(prefix));
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

	    if(!RoomPosition.prototype.hasOwnProperty('str')){
	        Object.defineProperty(RoomPosition.prototype, 'str', {
	            enumerable: false,
	            configurable: true,
	            get: function(){
	                return this.roomName + '-' + this.x + '-' + this.y;
	            }
	        });
	    }

	    RoomPosition.fromStr = function(str){
	        var parts = str.split('-');
	        return new RoomPosition(parseInt(parts[1]), parseInt(parts[2]), parts[0]);
	    }

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
	            if(result.incomplete){
	                distance = Math.max(_.size(result.path), start.getLinearDistance(end));
	            }else{
	                distance = _.size(result.path);
	            }
	            targetMem[pathName] = distance;
	        }
	        return distance;
	    }
	    
	    static generatePath(start, end, opts){
	        let weights = opts.weights || { plainCost: 2, swampCost: 10, roadCost: 1 };
	        let result = PathFinder.search(start, { pos: end, range: (opts.range || 1), maxOps: 10000 }, {
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
	        if(range > 1 && (target.pos.x < 2 || target.pos.y < 2 || target.pos.x > 47 || target.pos.y > 47)){
	            range = 1;
	        }
	        return creep.travelTo(target, { allowSK: false, ignoreCreeps: false, range, ignoreRoads: ignoreRoads, routeCallback: route });
	    }

	    static attackMove(creep, target){
	        return creep.travelTo(target, { allowSK: true, ignoreCreeps: false, allowHostile: true });
	    }
	}

	module.exports = Pathing;

/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	let VERSION = 5;
	let STAT_INTERVAL = 100;
	let LONGTERM_STAT_INTERVAL = 5000;

	const Cluster = __webpack_require__(4);
	const creeps = __webpack_require__(5);
	const Spawner = __webpack_require__(6);

	const creepCPU = function(creep){
	    if(!creep.ticksToLive || creep.ticksToLive > 1300){
	        return 0;
	    }
	    if(creep.getActiveBodyparts(CLAIM) > 0){
	        return creep.memory.cpu / (500 - creep.ticksToLive);
	    }
	    return creep.memory.cpu / (1500 - creep.ticksToLive);
	}

	class Startup {
	    static start(){
	        var ver = _.get(Memory, 'ver', 0);
	        if(ver < VERSION){
	            Startup.migrate(ver);
	        }

	        if(Game.interval(STAT_INTERVAL)){
	            Startup.longStats();
	            Startup.shortStats();
	            var heaviestCreep = _.max(Game.creeps, creepCPU);
	            if(heaviestCreep.getActiveBodyparts(CLAIM) > 0){
	                console.log(heaviestCreep.name, heaviestCreep.memory.cluster, heaviestCreep.memory.cpu, heaviestCreep.memory.cpu  / (500 - heaviestCreep.ticksToLive));
	            }else{
	                console.log(heaviestCreep.name, heaviestCreep.memory.cluster, heaviestCreep.memory.cpu, heaviestCreep.memory.cpu  / (1500 - heaviestCreep.ticksToLive));
	            }
	        }
	        if(Game.interval(LONGTERM_STAT_INTERVAL)){
	            var msg = 'Statistics: \n';
	            _.forEach(Memory.stats.longterm, (value, type)=>{
	                if(type != 'count'){
	                    msg += type + ': ' + value.toFixed(2) + '\n';
	                    console.log('LT', type+':', value.toFixed(2));
	                }
	            });
	            Memory.stats.longterm = {
	                count: {}
	            }
	            Game.notify(msg);

	            Startup.cleanup();
	        }

	        if(Game.intervalOffset(10, 1)){
	            var closest = 0;
	            Memory.levelroom = false;
	            Memory.stats.rooms = {};
	            _.forEach(Game.rooms, room => {
	                if(room.controller && room.controller.my && room.controller.level < 8){
	                    var percent = room.controller.progress / room.controller.progressTotal;
	                    Memory.stats.rooms[room.name] = room.controller.level + percent;
	                    if(percent > closest && room.controller.level >= 6){
	                        closest = percent;
	                        Memory.levelroom = room.name;
	                    }
	                }
	            });
	        }
	    }

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
	                _.forEach(Memory.clusters, cluster => {
	                    if(cluster.state.portals){
	                        cluster.opts.portals = cluster.state.portals;
	                        delete cluster.state.portals;
	                    }
	                });
	                Memory.state = {};
	            case 4:
	                _.forEach(Memory.clusters, cluster => {
	                    cluster.defense = {};
	                    delete cluster.nukes;
	                    delete cluster.repair;
	                });
	                Memory.squads = {};
	            case 5:
	            //TODO add migration
	            case 6:
	            //TODO add migration
	            case 7:
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
	        _.forEach(Memory.stats.profile, (value, type)=>console.log(type+':', value.toFixed(2)));
	        if(Game.cpu.bucket < 9500){
	            console.log('bucket:', Game.cpu.bucket);
	        }
	        var longterm = Memory.stats.longterm;
	        Memory.stats.longterm = null;
	        Memory.stats = {
	            longterm,
	            profile: {},
	            profileCount: {},
	            minerals: _.pick(_.mapValues(Game.federation.resources, 'total'), (amount, type) => type.length == 1 || type.length >= 5)
	        }
	    }

	    static longStats(){
	        _.forEach(Memory.stats.profile, (value, type)=>Game.longterm(type, value));
	    }

	    static processGenericFlags(){
	        let flags = Flag.getByPrefix('action');
	        for(let flag of flags){
	            let roomName = flag.pos.roomName;
	            let parts = flag.name.split('-');
	            let action = parts[1];
	            let target = parts[2];
	            switch(action){
	                case 'killroom':
	                    let confirmFlag = Game.flags['action-killroomconfirm'];
	                    let killFlag = Game.flags['action-killroom'];
	                    if(flag.room && killFlag && confirmFlag && killFlag.pos.roomName == confirmFlag.pos.roomName){
	                        console.log('Killing room', roomName);
	                        confirmFlag.remove();
	                        killFlag.remove();
	                        flag.room.find(FIND_MY_STRUCTURES).map(struct => struct.destroy());
	                    }
	                    break;
	                case 'harvest':
	                    Memory.rooms[roomName].harvest = true;
	                    flag.remove();
	                    break;
	                case 'debugroom':
	                    console.log(JSON.stringify(Memory.rooms[roomName]));
	                    flag.remove();
	                    break;
	                case 'towers':
	                    if(flag.room){
	                        var towers = _.filter(flag.room.find(FIND_MY_STRUCTURES), tower => tower.structureType == STRUCTURE_TOWER);
	                        for(var tower of towers){
	                            flag.room.visual.rect(tower.pos.x - 5.5, tower.pos.y - 5.5, 11, 11, {
	                                fill: '#00ff00',
	                                opacity: 0.1
	                            });
	                            flag.room.visual.rect(tower.pos.x - 10.5, tower.pos.y - 10.5, 21, 21, {
	                                fill: '#ffff00',
	                                opacity: 0.1
	                            });
	                            flag.room.visual.rect(tower.pos.x - 20.5, tower.pos.y - 20.5, 41, 41, {
	                                fill: '#ff0000',
	                                opacity: 0.1
	                            });
	                        }
	                    }
	                    break;
	                case 'set':
	                    let value = parts[3];
	                    if(value == 'true'){
	                        value = true;
	                    }else if(value == 'false'){
	                        value = false;
	                    }
	                    _.set(Memory.rooms, [roomName, target], value);
	                    console.log('Updated', roomName, JSON.stringify(Memory.rooms[roomName]));
	                    flag.remove();
	                    break;
	                case 'destroy':
	                    if(flag.room){
	                        let range = parts.length > 3 ? _.parseInt(parts[3]) : 1;
	                        let targets = flag.pos.findInRange(FIND_STRUCTURES, range, { filter: { structureType: target }});
	                        targets.forEach(target => target.destroy());
	                        flag.remove();
	                    }
	                    break;
	                case 'removesites':
	                    if(flag.room){
	                        let range = parts.length > 3 ? _.parseInt(parts[3]) : 50;
	                        let targets = flag.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, range, { filter: { structureType: target }});
	                        targets.forEach(target => target.remove());
	                        flag.remove();
	                    }
	                    break;
	                case 'gather':
	                    _.set(Memory.rooms, [flag.pos.roomName, 'gather'], flag.pos);
	                    console.log('Set gather point:', flag.pos);
	                    flag.remove();
	                    break;
	                case 'portal':
	                    let cluster = Game.clusters[target];
	                    if(cluster){
	                        if(!cluster.opts.portals){
	                            cluster.opts.portals = [];
	                        }
	                        cluster.opts.portals.push(flag.pos.roomName);
	                        console.log('Set cluster', target, 'to watch portal:', flag.pos.roomName);
	                    }else{
	                        console.log('action-portal - NO CLUSTER FOUND:', target);
	                    }
	                    flag.remove();
	                    break;
	                case 'hardpoints':
	                    let roomCluster = Game.clusterForRoom(flag.pos.roomName);
	                    if(roomCluster){
	                        var vis = new RoomVisual(flag.pos.roomName);
	                        vis.text('Hardpoints: '+_.size(roomCluster.defense.hardpoints), 25, 25);
	                        _.forEach(roomCluster.defense.hardpoints, hardpoint => {
	                            if(hardpoint.pos.roomName == flag.pos.roomName){
	                                vis.circle(hardpoint.pos.x, hardpoint.pos.y, {
	                                    radius: 0.5,
	                                    fill: hardpoint.type == 'longbow' ? '#0000ff' : '#ff0000'
	                                });
	                            }
	                        });
	                    }

	                    break;
	            }
	        }
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

	        Startup.processGenericFlags();
	    }

	    static cleanup(){
	        Memory.notify = _.pick(Memory.notify, tick => tick > Game.time);
	    }
	}

	module.exports = Startup;

/***/ },
/* 4 */
/***/ function(module, exports) {

	"use strict";

	// function catalogGlobal(resources, struct){
	//     if(struct.structureType == STRUCTURE_STORAGE || struct.structureType == STRUCTURE_TERMINAL){
	//         var stored = struct.getResourceList();
	//         for(let type in stored){
	//             let amount = stored[type];
	//             resources[type].global += amount;
	//             resources[type].globals[struct.structureType] += amount;
	//         }
	//     }
	// }

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
	        this.roles = this._roleRooms;

	        this._jobs = {};
	        this._hydratedJobs = {};
	        this._profile = {};
	        this._longprofile = {};

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
	        if(Game.intervalOffset(50, 1)){
	            let energy = _.filter(this.findAll(FIND_DROPPED_RESOURCES), { resourceType: RESOURCE_ENERGY });
	            let containers = _.filter(this.getAllStructures([STRUCTURE_CONTAINER, STRUCTURE_STORAGE, STRUCTURE_LINK]), struct => struct.getResource(RESOURCE_ENERGY) > 0);
	            let totalEnergy = _.sum(_.map(energy, 'amount')) + _.sum(_.map(containers, struct => struct.getResource(RESOURCE_ENERGY)));
	            this.update('totalEnergy', totalEnergy);
	            this.state.totalEnergy = totalEnergy;
	            this.profile('energy', this.totalEnergy);
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
	        Cluster.processClusterFlags();
	        _.forEach(Game.clusters, cluster => {
	            if(cluster.maxRCL < 3 || _.size(cluster.structures.spawn) == 0){
	                Memory.bootstrap = cluster.id;
	                cluster.bootstrap = true;
	            }
	            if(Game.interval(30)){
	                Cluster.cleanupTags(cluster);
	            }
	            if(Game.intervalOffset(200, 1)){
	                let roomLabs = _.mapValues(_.groupBy(cluster.structures.lab, 'pos.roomName'), (labs, roomName) => _.filter(labs, lab => !cluster.boost[lab.id]));
	                roomLabs = _.pick(roomLabs, labs => _.get(_.first(labs), 'room.terminal', false));
	                let labs = _.pick(_.mapValues(roomLabs, (labs, roomName) => _.map(_.sortBy(labs, lab => (lab.inRangeToAll(labs, 2) ? 'a' : 'z') + lab.id), 'id')), labs => labs.length > 2);
	                cluster.update('labs', _.values(labs));
	                cluster.state.labs = labs;
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
	            let parts = flag.name.split('-');
	            let tag = parts[1];
	            let target = Cluster.getFlagTarget(flag);
	            if(target && target.room && target.room.hasCluster()){
	                if(parts.length > 2 && parts[2] == 'remove'){
	                    console.log('Removed tag:', tag, 'from', target);
	                    target.room.getCluster().removeTag(tag, target.id);
	                }else{
	                    console.log('Added tag:', tag, 'to', target);
	                    target.room.getCluster().addTag(tag, target.id);
	                }
	                flag.remove();
	            }else if(Game.interval(25)){
	                console.log('cannot find flag target', flag.pos);
	            }
	        }
	        for(let flag of Flag.getByPrefix('boost')){
	            let parts = flag.name.split('-');
	            let type = parts[1];
	            let target = Cluster.getFlagTarget(flag);
	            if(target && target.room.hasCluster() && (type == 'remove' || Game.boosts[type])){
	                let cluster = target.room.getCluster();
	                if(type == 'remove'){
	                    delete cluster.boost[target.id];
	                    console.log("Removing boost from", target);
	                }else{
	                    cluster.boost[target.id] = type;
	                    console.log("Setting", target, "to boost", type, '-', Game.boosts[type]);
	                }
	            }
	            flag.remove();
	        }
	    }

	    static getFlagTarget(flag){
	        if(!flag.room){
	            return undefined;
	        }
	        return _.first(_.filter(flag.pos.lookFor(LOOK_STRUCTURES), struct => struct.structureType != STRUCTURE_ROAD && struct.structureType != STRUCTURE_RAMPART));
	    }

	    static createCluster(id){
	        //tags: stockpile, input, output, boost
	        let data = {
	            assignments: {},
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
	            stats: {},
	            statscount: {},
	            longstats: {},
	            longcount: {},
	            state: {}
	        };
	        _.set(Memory, ['clusters', id], data);
	        if(Game.clusters){
	            Game.clusters[id] = new Cluster(id, data, [], []);
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
	            harvest: role != 'reserve'
	        });
	        if(role == 'core'){
	            _.set(Memory, ['rooms', roomName, 'claim'], true);
	        }else if(_.has(Memory, ['rooms', roomName, 'claim'])){
	            delete Memory.rooms[roomName].claim;
	        }
	    }

	    changeRole(roomName, newRole){
	        Cluster.setRole(roomName, newRole, true);
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

	    get tagged(){
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
	                stored: 0,
	                sources: [],
	                storage: [],
	                terminal: [],
	                lab: [],
	                totals: {
	                    storage: 0,
	                    terminal: 0,
	                    lab: 0
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
	        this.state.energy = this._resources.energy.totals.storage / (600000 * this.structures.storage.length);
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

	    get damaged(){
	        if(!this._damaged){
	            if(!this.work.repair || this.work.repair.update <= Game.time){
	                let totals = {
	                    heavy: 0,
	                    moderate: 0,
	                    light: 0,
	                    total: 0
	                }
	                let targets = _.groupBy(this.findAll(FIND_STRUCTURES), struct => {
	                    var damage = struct.getMaxHits() - struct.hits;
	                    if(damage > 30000){
	                        totals.heavy += damage;
	                        return 'heavy';
	                    }
	                    if(damage > 500){
	                        totals.moderate += damage;
	                        return 'moderate';
	                    }
	                    if(damage > 0){
	                        totals.light += damage;
	                        return 'light';
	                    }
	                    return 'ignore';
	                });
	                totals.total = totals.heavy + totals.moderate + totals.light;
	                let repairData = {
	                    // light: _.map(_.slice(_.sortBy(targets.light, struct => -struct.getDamage()), 0, 20), 'id'),
	                    heavy: _.map(_.slice(_.sortBy(targets.heavy, struct => struct.hits / struct.getMaxHits()), 0, 20), 'id'),
	                    moderate: _.map(_.slice(_.sortBy(targets.moderate, struct => struct.hits / struct.getMaxHits()), 0, 20), 'id'),
	                    damage: totals,
	                    update: Game.time + 100
	                };
	                Memory.clusters[this.id].work.repair = repairData;
	                this.work.repair = repairData;
	            }
	            this._damaged = {
	                // light: _.filter(Game.getObjects(this.work.repair.light), target => target && target.getDamage() > 0),
	                moderate: _.filter(Game.getObjects(this.work.repair.moderate), target => target && target.getDamage() > 0),
	                heavy: _.filter(Game.getObjects(this.work.repair.heavy), target => target && target.getDamage() > 0)
	            };
	        }
	        return this._damaged;
	    }

	    findClosestCore(dest){
	        if(!dest){
	            return undefined;
	        }
	        let closest = false;
	        let distance = Infinity;
	        for(let room of this.getRoomsByRole('core')){
	            if(!room.controller){
	                continue;
	            }
	            let dist = room.controller.pos.getPathDistance(dest);
	            if(dist < distance){
	                distance = dist;
	                closest = room;
	            }
	        }
	        if(closest){
	            return {
	                room: closest,
	                distance
	            };
	        }
	    }

	    findNearestRoomByRole(originRoom, role){
	        if(!originRoom){
	            return undefined;
	        }
	        let closest = false;
	        let distance = Infinity;
	        let origin = originRoom.controller ? originRoom.controller.pos : new RoomPosition(25, 25, originRoom.name);
	        for(let room of this.getRoomsByRole(role)){
	            let target = room.controller ? room.controller.pos : new RoomPosition(25, 25, room.name);
	            let dist = origin.getPathDistance(target)
	            if(dist < distance){
	                distance = dist;
	                closest = room;
	            }
	        }
	        if(closest){
	            return {
	                room: closest,
	                distance
	            };
	        }
	    }

	    profile(type, value){
	        var count = this.statscount[type];
	        if(count === undefined){
	            this.stats[type] = value;
	            this.statscount[type] = 1;
	        }else{
	            this.stats[type] = (this.stats[type] * count + value)/(count + 1);
	            this.statscount[type]++;
	        }
	    }

	    profileAdd(type, value){
	        this._profile[type] = _.get(this._profile, type, 0) + value;
	    }

	    longterm(type, value){
	        var count = this.longcount[type];
	        if(count === undefined){
	            this.longstats[type] = value;
	            this.longcount[type] = 1;
	        }else{
	            this.longstats[type] = (this.longstats[type] * count + value)/(count + 1);
	            this.longcount[type]++;
	        }
	    }

	    longtermAdd(type, value){
	        this._longprofile[type] = _.get(this._longprofile, type, 0) + value;
	    }

	    finishProfile(){
	        _.forEach(this._profile, (value, type) => this.profile(type, value));
	        _.forEach(this._longprofile, (value, type) => this.longterm(type, value));
	    }

	    processStats(){
	        if(!this.longstats){
	            this.update('longstats', {});
	            this.update('longcount', {});
	        }
	        var output = this.id + ':';
	        output += ' damage: ' + _.get(this, 'work.repair.damage.heavy', 0) + ' / ' + _.get(this, 'work.repair.damage.moderate', 0) + '\n';
	        _.forEach(this.stats, (value, type)=>{
	            output += ' '+type+': ' + value.toFixed(2);
	            this.longterm(type, value);
	        });
	        console.log(output);
	        this.update('stats', {});
	        this.update('statscount', {});
	    }

	    processLongterm(){
	        var output = this.id + ':\n';
	        _.forEach(this.getRoomsByRole('core'), room =>{
	            var level = _.get(room, 'controller.level', Infinity);
	            if(level < 8){
	                var percent = (_.get(room, 'controller.progress', 0) / _.get(room, 'controller.progressTotal', 1));
	                output += ' ' + room.name + ': ' + level + ' - ' + percent.toFixed(2) + '\n';
	            }
	        });
	        output += ' damage: ' + _.get(this, 'work.repair.damage.heavy', 0) + ' / ' + _.get(this, 'work.repair.damage.moderate', 0) + '\n';
	        _.forEach(this.longstats, (value, type)=>{
	            output += ' '+type+': ' + value.toFixed(2)+'\n';
	        });
	        console.log('LT:', output);
	        Game.notify(output);
	        this.update('longstats', {});
	        this.update('longcount', {});
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

	var template = {
	    defender: {
	        quota: 'defend-defend',
	        critical: true,
	        parts: {
	            micro: { tough: 5, move: 15, ranged_attack: 10 },
	            nano: { tough: 5, move: 10, ranged_attack: 5 },
	            pico: { tough: 5, move: 7, ranged_attack: 2 },
	            femto: { tough: 2, move: 4, ranged_attack: 2 }
	        },
	        work: { defend: {}, idle: { subtype: 'tower' } },
	        variants: {
	            rampart: {
	                quota: 'rampart-defend',
	                parts: {
	                    milli: { attack: 40, move: 10 },
	                },
	                work: { defend: { subtype: 'rampart' } },
	                behavior: { rampart: { range: 1 } }
	            }
	        }
	    },
	    longbow: {
	        quota: 'longbow-defend',
	        critical: true,
	        boost: {
	            milli: { fatigue: 10, rangedAttack: 40 }
	        },
	        parts: {
	            milli: { ranged_attack: 40, move: 10 }//,
	            // micro: { ranged_attack: 40, move: 10 }
	        },
	        work: { defend: { subtype: 'longbow' } },
	        behavior: { boost: { required: true }, rampart: { range: 3 } }
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
	        behavior: { },
	        variants: {
	            fallback: {
	                emergency: false,
	                allocationMulti: 100,
	                parts: { pico: {carry: 4, move: 2 } }
	            },
	            tower: {
	                emergency: false,
	                allocationMulti: 50,
	                quota: 'tower-deliver',
	                assignRoom: 'tower',
	                work: {
	                    pickup: { local: true },
	                    deliver: { subtype: 'tower', local: true },
	                    idle: { subtype: 'tower', local: true }
	                },
	                behavior: { avoid: {} }
	            }
	        }
	    },
	    energyminer: {
	        quota: 'energy-mine',
	        critical: true,
	        allocation: 'work',
	        allocationMax: 6,
	        parts: {
	            kilo: { move: 6, carry: 4, work: 6 },
	            milli: { move: 4, carry: 2, work: 6 },//standard 1100
	            micro: { move: 3, carry: 1, work: 6 },//800
	            nano: { move: 2, carry: 2, work: 3 },//550
	            pico: { move: 1, carry: 1, work: 2 }//300
	        },
	        emergency: 'pico',
	        work: { mine: { subtype: 'energy' } },
	        behavior: { avoid: {}, minecart: {} }
	    },
	    hauler: {
	        quota: 'harvesthauler',
	        allocation: 'carry',
	        allocationMax: 24,
	        parts: haulerParts,
	        assignRoom: 'harvest',
	        work: {
	            pickup: { subtype: 'harvest', local: true },
	            deliver: { subtype: 'storage' }
	        },
	        behavior: { avoid: {} },
	        variants: {
	            stockpile: {
	                quota: 'stockpile-deliver',
	                allocationMulti: 50,
	                allocationMax: Infinity,
	                work: { 
	                    pickup: {},
	                    deliver: { subtype: 'stockpile' },
	                    idle: { subtype: 'spawn' }
	                },
	                assignRoom: false
	            },
	            mineral: {
	                quota: 'mineral-pickup',
	                allocationMulti: 50,
	                allocationMax: Infinity,
	                parts: { 
	                    milli: { carry: 24, move: 12 },
	                    micro: { carry: 16, move: 8 }
	                },
	                work: {
	                    pickup: { subtype: 'mineral' },
	                    deliver: { subtype: 'terminal' },
	                    idle: { subtype: 'extractor' }
	                },
	                assignRoom: false
	            }
	        }
	    },
	    reserver: {
	        quota: 'reserve',
	        allocation: 'claim',
	        allocationMax: 2,
	        critical: false,
	        parts: {
	            micro: { claim: 4, move: 4 },
	            nano: { claim: 2, move: 2 },
	            pico: { claim: 1, move: 1 }
	        },
	        work: { reserve: {} },
	        behavior: { avoid: {} },
	        variants: {
	            downgrade: {
	                quota: 'downgrade',
	                allocation: 1,
	                allocationMax: 4,
	                critical: false,
	                work: { downgrade: { } },
	                parts: { pico: { claim: 5, move: 5 } }
	            }
	        }
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
	            mega: { move: 15, carry: 20, work: 10 },
	            kilo: { move: 17, carry: 12, work: 5 },//1700
	            milli: { move: 10, carry: 6, work: 4 },//1200
	            micro: { move: 7, carry: 5, work: 2 },//800
	            nano: { move: 4, carry: 2, work: 2 },//550
	            pico: { move: 2, carry: 1, work: 1 }//300
	        },
	        work: { pickup: { priority: 5 }, build: {}, repair: { priority: 99 } },
	        behavior: { avoid: {} }
	    },
	    upgradeworker: {
	        quota: 'upgrade',
	        allocation: 'work',
	        parts: {
	            //mega: { work: 15, move: 24, carry: 9 },//2700
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
	        quota: 'repair-repair',
	        allocation: 5,
	        maxQuota: 20,
	        parts: {
	            kilo: { move: 10, carry: 10, work: 10 },
	            milli: { move: 6, carry: 7, work: 5 },//1150
	            micro: { move: 7, carry: 5, work: 2 },//800
	            nano: { move: 5, carry: 4, work: 1 },//550
	            pico: { move: 2, carry: 1, work: 1 }//300
	        },
	        work: { pickup: { priority: 1 }, repair: { subtype: 'repair' }, idle: { subtype: 'spawn' } },
	        behavior: { avoid: {}, repair: {} },
	        variants: {
	            heavy: {
	                quota: 'heavy-repair',
	                allocation: 3,
	                maxQuota: 20,
	                parts: {
	                    micro: { move: 16, carry: 12, work: 20 },
	                    nano: { move: 10, carry: 10, work: 10 },
	                    pico: { move: 6, carry: 7, work: 5 },
	                    femto: { move: 2, carry: 1, work: 1 }
	                },
	                work: { pickup: { priority: 1 }, repair: { subtype: 'heavy' }, idle: { subtype: 'spawn' } },
	                behavior: { avoid: {}, boost: {} }
	            },
	            bunker: {
	                quota: 'bunker-repair',
	                allocation: 1,
	                maxQuota: 4,
	                boost: {
	                    milli: { repair: 20 }
	                },
	                parts: {
	                    milli: { move: 16, carry: 12, work: 20 },
	                    micro: { move: 16, carry: 12, work: 20 },
	                    nano: { move: 10, carry: 10, work: 10 },
	                    pico: { move: 6, carry: 7, work: 5 },
	                    femto: { move: 2, carry: 1, work: 1 }
	                },
	                work: { pickup: { priority: 1 }, repair: { subtype: 'bunker' }, idle: { subtype: 'storage' } },
	                behavior: { avoid: {}, boost: {} }
	            }
	        }
	    },
	    observer: {
	        quota: 'observe',
	        critical: true,
	        parts: { pico: { move: 1 } },
	        work: { observe: {} },
	        behavior: { avoid: {} },
	        variants: {
	            poker: {
	                quota: 'poke-observe',
	                work: { observe: { subtype: 'poke' } }
	            }
	        }
	    },
	    healer: {
	        quota: 'heal',
	        maxQuota: 1,
	        parts: {
	            micro: { move: 4, heal: 4 },
	            nano: { move: 2, heal: 2 },
	            pico: { move: 1, heal: 1 }
	        },
	        work: { heal: {} },
	        behavior: { avoid: {} }
	    },
	    mineralminer: {
	        quota: 'mineral-mine',
	        allocation: 'work',
	        allocationMax: 6,
	        parts: {
	            milli: { move: 12, carry: 4, work: 24 },
	            nano: { move: 8, carry: 4, work: 16 },
	            pico: { move: 4, carry: 4, work: 8 }
	        },
	        work: { mine: { subtype: 'mineral' } },
	        behavior: { avoid: {}, minecart: {} }
	    },
	    transferhauler: {
	        quota: 'transfer',
	        critical: true,
	        maxQuota: 3,
	        allocation: 1,
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
	    attacker: {
	        quota: 'attack',
	        maxQuota: 6,
	        critical: true,
	        boost: {
	            milli: { fatigue: 10, damage: 5, rangedAttack: 25, heal: 10 }
	        },
	        parts: {
	            milli: { tough: 5, ranged_attack: 25, move: 10, heal: 10 }
	        },
	        work: { attack: {} },
	        behavior: { selfheal: { auto: true }, rampart: { range: 3 }, boost: {} }
	    }
	}

	function buildCreeplist(creeps){
	    var result = _.cloneDeep(creeps);
	    for(var type in creeps){
	        var config = creeps[type];
	        if(config.variants){
	            for(var variant in config.variants){
	                var modification = config.variants[variant];
	                result[variant+'-'+type] = _.assign(_.cloneDeep(creeps[type]), modification);
	            }
	        }
	    }
	    return result;
	}

	module.exports = buildCreeplist(template);

/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const creepsConfig = __webpack_require__(5);

	const spawnFreeCheck = function(spawn){
	    return spawn.spawning === null;
	};

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
	                spawned = Spawner.spawnCreep(targetCluster, spawn, spawnlist, type, cluster);
	            }
	        });
	        return spawned;
	    }

	    static hasFreeSpawn(cluster){
	        return _.any(cluster.structures.spawn, spawnFreeCheck);
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
	            if(config.deprecated){
	                return;
	            }
	            let emergency = cluster.id == targetCluster.id && config.critical && config.emergency && _.get(allocation, config.quota, 0) == 0;
	            let maxCost = 0;
	            let version = false;
	            let partSet = false;
	            if(emergency){
	                let cost = Spawner.calculateCost(config.parts[config.emergency]);
	                maxCost = cost;
	                version = config.emergency;
	                partSet = config.parts[config.emergency];
	            }else{
	                _.forEach(config.parts, (parts, ver) => {
	                    let cost = Spawner.calculateCost(parts);
	                    let hasCapacity = !config.boost || !config.boost[ver] || Spawner.calculateBoostCapacity(targetCluster, config, ver, cluster) > 0;
	                    if(cost > maxCost && cost <= cluster.maxSpawn && hasCapacity){
	                        maxCost = cost;
	                        version = ver;
	                        partSet = parts;
	                    }
	                });
	            }
	            if(version){
	                const limit = Spawner.calculateBoostCapacity(targetCluster, config, version, cluster);
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
	            limit = Spawner.calculateBoostCapacity(cluster, config, version);
	        }
	        return limit;
	    }

	    static calculateBoostCapacity(cluster, config, version, originCluster){
	        if(config.boost && config.boost[version]){
	            return _.min(_.map(config.boost[version], (amount, type) => Math.floor((_.get(originCluster.boostMinerals, Game.boosts[type], 0) / 30) / amount)));
	        }
	        return Infinity;
	    }

	    static spawnCreep(cluster, spawn, spawnlist, spawnType, originCluster){
	        var versionName = spawnlist.version[spawnType];
	        var config = creepsConfig[spawnType];
	        var mem = Spawner.prepareSpawnMemory(cluster, config, spawnType, versionName, originCluster);
	        if(spawn.room.memory.cluster != cluster.id){
	            mem.bootstrap = true;
	        }
	        var spawned = spawn.createCreep(spawnlist.parts[spawnType], spawnType+'-'+Memory.uid, mem);
	        Memory.uid++;
	        if(spawned){
	            console.log(cluster.id, '-', spawn.name, 'spawning', spawned, spawnlist.costs[spawnType]);
	            cluster.longtermAdd('spawn', _.size(spawnlist.parts[spawnType]) * 3);
	            // cluster.longtermAdd('spawn-energy', spawnlist.costs[spawnType]);
	        }else{
	            Game.notify('Could not spawn!', cluster.id, spawnType, spawn.name);
	        }
	        return spawned;
	    }

	    static canSpawn(spawn, parts, cost){
	        return spawn.room.energyAvailable >= cost && spawn.canCreateCreep(parts) == OK;
	    }

	    static prepareSpawnMemory(cluster, config, type, version, originCluster){
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
	            if(originCluster.id != cluster.id){
	                memory.boostCluster = originCluster.id;
	                console.log('Cross-spawn boost', type, cluster.id, originCluster.id);
	            }
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
	const DEFAULT_MAXOPS = 20000;
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
	                    console.log(`attempting path without findRoute was ${ret.incomplete ? "not" : ""} successful, ${creep.pos.roomName} -> ${destination.pos.roomName}`);
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
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	// global, but fancier

	var DefenseMatrix = __webpack_require__(9);

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

	class Federation {
	    constructor(){
	        this.matrix = new DefenseMatrix();
	        Game.matrix = this.matrix;
	    }

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

	    get roomflags(){
	        if(!this._roomflags){
	            this._roomflags = _.groupBy(Game.flags, 'pos.roomName');
	        }
	        return this._roomflags;
	    }

	}

	module.exports = Federation;

	//Game.federation.resources.H.terminal.map(terminal=>terminal.send('H', terminal.store.H || 0, 'E28S73'))

/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	
	const Util = __webpack_require__(10);

	const whitelist = [
	    'likeafox'
	];

	const partValues = {
	    heal: HEAL_POWER,
	    attack: ATTACK_POWER,
	    ranged_attack: RANGED_ATTACK_POWER,
	    work: DISMANTLE_POWER
	};

	const boostTypes = {
	    heal: 'heal',
	    attack: 'attack',
	    ranged_attack: 'rangedAttack',
	    work: 'dismantle'
	}

	class DefenseMatrix {
	    constructor(){
	        this.rooms = {};
	    }

	    static getOwnerType(creep){
	        if(creep.my){
	            return 'mine';
	        }
	        if(!creep.owner){
	            Game.notify('Invalid owner: ' + JSON.stringify(creep));
	            console.log('Invalid owner: ' + JSON.stringify(creep));
	            return 'friendly';
	        }
	        var owner = creep.owner.username;
	        if(owner == 'likeafox' || owner == 'Vlahn' || owner == 'NobodysNightmare'){
	            return 'friendly';
	        }
	        if(owner == 'Source Keeper'){
	            return 'keeper';
	        }
	        if(owner == 'Invader'){
	            return 'invader';
	        }
	        return 'player';
	    }

	    static characterize(totals, armed, creep){
	        var ownerType = DefenseMatrix.getOwnerType(creep);
	        var details = {
	            attack: 0,
	            heal: 0,
	            ranged_attack: 0,
	            work: 0,
	            ownerType,
	            hostile: !creep.my && ownerType != 'friendly'
	        };
	        for(let part of creep.body){
	            if(part.hits > 0){
	                if(part.type == 'attack' || part.type == 'heal' || part.type == 'ranged_attack' || part.type == 'work'){
	                    var multi = 1;
	                    if(part.boost){
	                        multi = _.get(BOOSTS, [part.type, part.boost, boostTypes[part.type]], 1);
	                    }
	                    details[part.type] += partValues[part.type] * multi;
	                }
	            }
	        }
	        if(details.attack > 0 || details.ranged_attack > 0){
	            armed.push(creep);
	        }
	        creep.details = details;
	        var typeData = totals[ownerType];
	        if(!typeData){
	            typeData = {
	                attack: 0,
	                heal: 0,
	                ranged_attack: 0,
	                work: 0,
	                count: 0
	            };
	            totals[ownerType] = typeData;
	        }
	        typeData.attack += details.attack;
	        typeData.heal += details.heal;
	        typeData.ranged_attack += details.ranged_attack;
	        typeData.work += details.work;
	        typeData.count++;

	        totals.attack += details.attack;
	        totals.heal += details.heal;
	        totals.ranged_attack += details.ranged_attack;
	        totals.work += details.work;
	        totals.count++;
	        return ownerType;
	    }

	    static isSiegeMode(creeps, totals){
	        return creeps.player
	            && creeps.player.length > 0
	            && totals.player
	            && totals.player.heal > 200;
	    }

	    startup(){
	        Game.perf();
	        _.forEach(Game.rooms, room => {
	            var hostiles = room.find(FIND_HOSTILE_CREEPS);
	            var totals = {
	                attack: 0,
	                heal: 0,
	                ranged_attack: 0,
	                work: 0,
	                count: 0
	            };
	            var creeps;
	            var enemy;
	            var armed = [];
	            if(hostiles.length > 0){
	                creeps = _.groupBy(hostiles, DefenseMatrix.characterize.bind(null, totals, armed));
	                enemy = _.filter(hostiles, 'details.hostile');
	            }else{
	                enemy = [];
	                creeps = {};
	            }
	            var data = {
	                room,
	                armed,
	                hostiles: enemy,
	                damaged: [],
	                safemode: _.get(room, 'controller.safeMode', false),
	                keeper: false,
	                target: _.first(enemy),
	                towers: [],
	                creeps,
	                underSiege: DefenseMatrix.isSiegeMode(creeps, totals),
	                total: totals,
	                targetted: false
	            };
	            if(data.underSiege && (room.memory.defend || room.memory.tripwire)){
	                var message = 'Warning: Player creeps detected in our territory: ' + room.name + ' - ' + _.get(matrix.creeps, 'player[0].owner.username', 'Unknown');
	                Game.note('playerWarn'+room.name, message);
	                if(room.cluster){
	                    room.cluster.state.defcon = Game.time + 500;
	                }
	            }
	            this.rooms[room.name] = data;
	        });
	        _.forEach(Game.creeps, creep => {
	            if(creep.hits < creep.hitsMax){
	                this.rooms[creep.room.name].damaged.push(creep);
	            }
	        });
	        if(Flag.prefix.defend){
	            for(var flag of Flag.prefix.defend){
	                var cluster = Game.clusterForRoom(flag.pos.roomName);
	                if(cluster && flag.parts.length > 1){
	                    if(!cluster.defense.hardpoints){
	                        cluster.defense.hardpoints = {};
	                    }
	                    if(flag.parts[1] == 'remove'){
	                        delete cluster.defense.hardpoints[flag.pos.str];
	                        console.log('Removed defend order:', flag.pos, flag.parts[1]);
	                    }else{
	                        cluster.defense.hardpoints[flag.pos.str] = {
	                            type: flag.parts[1],
	                            pos: flag.pos
	                        };
	                        console.log('Defending:', flag.pos, flag.parts[1]);
	                    }
	                    flag.remove();
	                }
	            }
	        }

	        Game.perf('matrix');
	    }

	    process(cluster){
	        _.forEach(cluster.structures.tower, tower => {
	            if(tower.energy >= 10){
	                this.rooms[tower.pos.roomName].towers.push(tower);
	            }
	        });
	        var remaining = cluster.state.defcon - Game.time;
	        var tickMessage = 'DEFCON: ' + remaining;
	        _.forEach(cluster.rooms, room => {
	            let data = this.rooms[room.name];
	            if(data.hostiles.length > 0 && room.memory.role != 'core'){
	                let nearest = cluster.findNearestRoomByRole(room, 'core');
	                if(nearest){
	                    let roomData = Memory.rooms[nearest.room.name];
	                    if(roomData && roomData.gather){
	                        data.fleeTo = new RoomPosition(roomData.gather.x, roomData.gather.y, roomData.gather.roomName);
	                        data.fleeToRange = 3;
	                    }else{
	                        data.fleeTo = new RoomPosition(25, 25, nearest.room.name);
	                        data.fleeToRange = 15;
	                    }
	                }
	            }
	            if(remaining > 0){
	                room.visual.text(tickMessage, 25, 25);
	            }
	        });
	        if(Game.intervalOffset(10, 5)){
	            cluster.defense.longbow = {};
	            cluster.defense.rampart = {};
	            if(cluster.state.defcon > Game.time && cluster.defense.hardpoints){
	                for(let id in cluster.defense.hardpoints){
	                    let data = cluster.defense.hardpoints[id];
	                    cluster.defense[data.type][id] = {
	                        id,
	                        pos: data.pos
	                    };
	                }
	            }
	        }
	    }

	    helpers(){
	        let flags = Flag.getByPrefix('tower');
	        for(let flag of flags){
	            if(flag.room){
	                flag.room.visual.rect(flag.pos.x - 5.5, flag.pos.y - 5.5, 11, 11, {
	                    fill: '#ff0000',
	                    opacity: 0.1
	                });
	                flag.room.visual.rect(flag.pos.x - 10.5, flag.pos.y - 10.5, 21, 21, {
	                    fill: '#ff0000',
	                    opacity: 0.1
	                });
	                flag.room.visual.rect(flag.pos.x - 20.5, flag.pos.y - 20.5, 41, 41, {
	                    fill: '#ff0000',
	                    opacity: 0.1
	                });
	            }
	        }
	        if(Game.flags.clearTower){
	            flags.forEach(flag => flag.remove());
	            Game.flags.clearTower.remove();
	        }
	    }
	}

	module.exports = DefenseMatrix;

/***/ },
/* 10 */
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
	    
	    static distance(entity, entities){
	        return _.sortBy(entities, SortPredicates.distance(entity));
	    }
	    
	    static distancePath(entity, entities){
	        return _.sortBy(entities, SortPredicates.distancePath(entity));
	    }

	    static closest(entity, entities){
	        return _.sortBy(entities, SortPredicates.distance(entity));
	    }
	    
	    static closestPath(entity, entities){
	        return _.sortBy(entities, SortPredicates.distancePath(entity));
	    }
	}

	module.exports = {
	    closest: function(entity, entities){
	        return _.first(Sorting.distance(entity, entities));
	    },
	    furthest: function(entity, entities){
	        return _.last(Sorting.distance(entity, entities));
	    },
	    sort: Sorting,
	    predicates: {
	        sort: SortPredicates
	    }
	};

/***/ },
/* 11 */
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
	            }
	        }
	        return count;
	    }

	    generateBuildingList(){
	        var result = {
	            extensions: [],
	            roads: []
	        };
	        var buildRoads = _.get(this.room, 'memory.buildroads', 0) < Game.time;
	        if(this.spawn && this.room.getAvailableStructureCount(STRUCTURE_EXTENSION) > 0){
	            var out = new Set();
	            this.placeExtensions(this.spawn.pos.x, this.spawn.pos.y, 0, new Set(), doublerpos, out);
	            result.extensions = _.sortBy([...out], extension => this.spawn.pos.getRangeTo(ix2pos(extension, this.room.name)));
	            buildRoads = true;
	        }
	        if(buildRoads){
	            result.roads = [...this.placeRoads()];
	            _.set(this.room, 'memory.buildroads', Game.time + 5000);
	        }
	        return result;
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
	                    this.addRoadsAround(struct, roads, 1);
	                    break;
	                case STRUCTURE_SPAWN:
	                case STRUCTURE_STORAGE:
	                    this.addRoadsAround(struct, roads, 1);
	                    break;
	                case STRUCTURE_CONTROLLER:
	                    if(this.room.memory.role == 'core'){
	                        this.addRoadsAround(struct, roads, 1);
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
	            this.addRoadsAround(source, roads, 1);
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
	            for(let road of structs.roads){
	                let targetPos = ix2pos(road, this.room.name);
	                targetPos.createConstructionSite(STRUCTURE_ROAD);
	            }
	        }
	        if(structs.extensions.length > 0){
	            let total = this.room.getAvailableStructureCount(STRUCTURE_EXTENSION);
	            let ix = 0;
	            for(let extension of structs.extensions){
	                if(ix >= total){
	                    break;
	                }
	                let targetPos = ix2pos(extension, this.room.name);
	                console.log('Building extension at', targetPos);
	                targetPos.createConstructionSite(STRUCTURE_EXTENSION);
	                ix++;
	            }
	        }
	        // if(structs.containers.length > 0){
	        //     let targetPos = ix2pos(_.first(structs.containers), this.room.name);
	        //     console.log('Building container at', targetPos);
	        //     targetPos.createConstructionSite(STRUCTURE_CONTAINER);
	        // }
	        if(!this.extractor && this.room.memory.role == 'core' && this.room.getAvailableStructureCount(STRUCTURE_EXTRACTOR) > 0){
	            let mineral = _.first(this.room.find(FIND_MINERALS));
	            if(mineral){
	                console.log('Building extractor at', mineral.pos);
	                mineral.pos.createConstructionSite(STRUCTURE_EXTRACTOR);
	            }
	        }
	        // this.placeTags();
	    }

	    findNearby(pos, type, range){
	        var buildings = this.buildings[type] || [];
	        return _.filter(buildings, struct => pos.getRangeTo(struct) <= range);
	    }

	    findNearbyTypes(pos, types, range){
	        return _.filter(this.structures, struct => types.includes(struct.structureType) && pos.getRangeTo(struct) <= range);
	    }

	    // placeContainers(){
	    //     var containerPos = new Set();
	    //     var pos = 0;
	    //     var sources = this.sources;
	    //     if(this.room.memory.role == 'core' || this.room.memory.keep){
	    //         sources = sources.concat(this.room.find(FIND_MINERALS) || []);
	    //     }
	    //     for(let source of sources){
	    //         if(this.countNearby([this.values.container, this.values.storage, this.values.link], pos2ix(source.pos), 2) > 0){
	    //             continue;
	    //         }
	    //         let target = this.findAccessibleSpot(source.pos, 1);
	    //         if(target){
	    //             this.vis.circle(ix2x(target), ix2y(target), { fill: '#ff0000' });
	    //             containerPos.add(target);
	    //         }
	    //     }
	    //     if(this.room.controller && this.room.memory.role == 'core'){
	    //         let pos = this.room.controller.pos;
	    //         if(this.countNearby([this.values.container, this.values.storage, this.values.link], pos2ix(pos), 2) == 0){
	    //             let target = this.findAccessibleSpot(pos, 2);
	    //             if(target){
	    //                 this.vis.circle(ix2x(target), ix2y(target), { fill: '#ff0000' });
	    //                 containerPos.add(target);
	    //             }
	    //         }
	    //     }
	    //     return containerPos;
	    // }

	    // static buildInfrastructureRoads(cluster){
	    //     if(cluster.structures.storage.length > 0 && _.size(Game.constructionSites) < 20){
	    //         for(let source of cluster.findAll(FIND_SOURCES)){
	    //             let storage = AutoBuilder.findNearest(cluster, source.pos, STRUCTURE_STORAGE);
	    //             if(storage){
	    //                 AutoBuilder.buildRoads(source.pos, storage.pos);
	    //             }
	    //         }
	    //         for(let extractor of cluster.getAllStructures([STRUCTURE_EXTRACTOR, STRUCTURE_CONTROLLER])){
	    //             let storage = AutoBuilder.findNearest(cluster, extractor.pos, STRUCTURE_STORAGE);
	    //             if(storage){
	    //                 AutoBuilder.buildRoads(extractor.pos, storage.pos);
	    //             }
	    //         }
	    //     }
	    // }

	    // placeTags(){
	    //     if(this.room.controller && this.room.memory.role == 'core'){
	    //         let pos = this.room.controller.pos;
	    //         let containers = this.findNearby(pos, STRUCTURE_CONTAINER, 3);
	    //         if(containers.length > 0 && !containers.some(container => container.hasTag('stockpile'))){
	    //             for(let container of containers){
	    //                 if(!container.hasTag('stockpile')){
	    //                     container.addTag('stockpile');
	    //                     console.log('Added stockpile tag to', container, 'in', container.pos.roomName);
	    //                     break;
	    //                 }
	    //             }
	    //         }
	    //         let links = this.findNearby(pos, STRUCTURE_LINK, 3);
	    //         if(links.length > 0 && !links.some(link => link.hasTag('output'))){
	    //             for(let link of links){
	    //                 if(!link.hasTag('output')){
	    //                     link.addTag('output');
	    //                     console.log('Added link output tag to', link, 'in', link.pos.roomName);
	    //                     break;
	    //                 }
	    //             }
	    //         }
	    //     }
	    //     for(let source of this.sources){
	    //         let links = this.findNearby(source.pos, STRUCTURE_LINK, 2);
	    //         if(links.length > 0 && !links.some(link => link.hasTag('input'))){
	    //             for(let link of links){
	    //                 if(!link.hasTag('input')){
	    //                     link.addTag('input');
	    //                     console.log('Added link input tag to', link, 'in', link.pos.roomName);
	    //                     break;
	    //                 }
	    //             }
	    //         }
	    //     }
	    //     // cluster.update('labs', _.filter(_.map(cluster.rooms, room => _.map(cluster.getStructuresByType(room, STRUCTURE_LAB), 'id')), list => list.length > 0));
	    // }



	}

	module.exports = AutoBuilder;

/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const Util = __webpack_require__(10);
	const roomRegex = /([WE])(\d+)([NS])(\d+)/;
	const ENERGY_TRANSFER_AMOUNT = 20000;

	const autobuyPriceLimit = {
	    H: 0.31,
	    O: 0.26,
	    XKHO2: 1.51,
	    XZHO2: 1.51,
	    XGHO2: 1.51
	};

	class Controller {

	    static federation(allocated){
	        if(Game.interval(10)){
	            _.forEach(Game.flags, flag =>{
	                if(!flag.room){
	                    Memory.observe[flag.pos.roomName] = Game.time + 98;
	                    console.log('Observing', flag.pos.roomName);
	                }
	            });
	        }
	        if(Game.interval(20)){
	            var buildFlags = Flag.getByPrefix('Build');
	            _.forEach(buildFlags, flag => Controller.buildFlag(flag));

	            for(let term of Game.federation.structures.terminal){
	                if(term.cooldown > 0){
	                    allocated[term.id] = true;
	                }
	            }

	            Controller.fillRequests(allocated);
	            Controller.levelTerminals(allocated);
	            Controller.terminalEnergy(allocated);
	            // Controller.emptyTerminals();
	        }

	        var observers = _.filter(Game.federation.structures.observer, struct => !_.includes(allocated, struct.id));
	        var portalWatch = Flag.getByPrefix('PortalWatch');
	        if(portalWatch.length && observers.length > 0){
	            for(var flag of portalWatch){
	                var roomName = flag.pos.roomName;
	                let observer = _.min(observers, ob => Game.map.getRoomLinearDistance(roomName, ob.pos.roomName));
	                if(observer && observer.pos && Game.map.getRoomLinearDistance(roomName, observer.pos.roomName) < 10){
	                    _.pull(observers, observer);
	                    if(observer.observeRoom(roomName) == OK){
	                        new RoomVisual(roomName).text('PortalWatch Observed by '+observer.pos.roomName, 25, 25);
	                        if(Memory.observe[roomName]){
	                            delete Memory.observe[roomName];
	                        }
	                    }
	                }else{
	                    console.log('PW No observer for', roomName);
	                }
	                if(flag.room){
	                    let room = flag.room;
	                    let matrix = room.matrix;
	                    if(matrix.creeps.player){
	                        var message = 'Warning: Player creeps detected: ' + room.name + ' - ' + _.get(matrix.creeps, 'player[0].owner.username', 'Unknown');
	                        Game.note('portalWarn'+room.name, message);
	                        for(let clusterName in Game.clusters){
	                            var cluster = Game.clusters[clusterName];
	                            if(cluster.opts.portals && _.includes(cluster.opts.portals, room.name)){
	                                cluster.state.defcon = Game.time + 1000;
	                            }
	                        }
	                    }
	                }
	            }
	        }

	        if(_.size(Memory.observe) > 0){
	            for(let roomName in Memory.observe){
	                if(observers.length > 0){
	                    let observer = _.min(observers, ob => Game.map.getRoomLinearDistance(roomName, ob.pos.roomName));
	                    if(observer && observer.pos && Game.map.getRoomLinearDistance(roomName, observer.pos.roomName) < 10){
	                        _.pull(observers, observer);
	                        if(observer.observeRoom(roomName) == OK){
	                            new RoomVisual(roomName).text('Observed by '+observer.pos.roomName, 25, 25);
	                        }
	                    }else{
	                        console.log('No observer for', roomName);
	                    }
	                }
	            }
	        }

	        if(Game.intervalOffset(50, 11)){
	            Controller.autobuyResources(allocated);
	        }

	        if(Game.intervalOffset(10, 1)){
	            _.forEach(Memory.state.reaction, (data, type) => Controller.runReaction(type, data));
	        }
	    }

	    static control(cluster, allocated){

	        var scanner = Game.getObjectById(cluster.scanner);
	        if(scanner){
	            allocated[scanner.id] = true;
	            var scanPos = roomRegex.exec(scanner.pos.roomName);
	            if(scanPos){
	                var lastX = (Game.time % 18) - 9 + parseInt(scanPos[2]);
	                var lastY = Math.floor((Game.time % 324) / 18) - 9 + parseInt(scanPos[4]);
	                var scanRoom = Game.rooms[scanPos[1]+lastX+scanPos[3]+lastY];
	                if(scanRoom){
	                    var owner = _.get(scanRoom, 'controller.owner.username');
	                    var reserved = _.get(scanRoom, 'controller.reservation.username');
	                    if(owner && !scanRoom.controller.my){
	                        let buildings = scanRoom.find(FIND_HOSTILE_STRUCTURES);
	                        if(buildings.length > 5){
	                            Memory.avoidRoom[scanRoom.name] = true;
	                        }else{
	                            delete Memory.avoidRoom[scanRoom.name];
	                        }
	                    }else if(reserved && reserved != 'Zeekner'){
	                        Memory.avoidRoom[scanRoom.name] = true;
	                    }else if(!scanRoom.controller){
	                        let buildings = scanRoom.find(FIND_HOSTILE_STRUCTURES);
	                        if(buildings.length > 3){
	                            Memory.avoidRoom[scanRoom.name] = true;
	                        }else{
	                            delete Memory.avoidRoom[scanRoom.name];
	                        }
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
	            let hardTarget = false;
	            if(tower.room.memory.halt){
	                return;
	            }
	            if(tower.energy >= 10){
	                let data = Game.matrix.rooms[tower.pos.roomName];
	                let hostile = data.target;
	                if(data.targetted){
	                    let best = Game.getObjectById(_.max(data.targetted, 'value').id);
	                    if(best){
	                        hostile = best;
	                        hardTarget = true;
	                    }
	                }
	                if(data.damaged.length > 0){
	                    action = tower.heal(_.first(data.damaged)) == OK;
	                }
	                var energySaver = cluster.totalEnergy < 250000 && (data.armed.length == 0 && data.total.work == 0);
	                if(!action && hostile && (tower.energy > 500 || hardTarget || hostile.hits < hostile.maxHits * 0.5) && !energySaver){
	                    action = tower.attack(hostile) == OK;
	                }
	                if(!action && !hostile){
	                    if(Game.interval(20)){
	                        let critStruct = _.first(_.sortBy(_.filter(cluster.find(tower.room, FIND_STRUCTURES), struct => struct.hits < 400), target => tower.pos.getRangeTo(target)));
	                        if(critStruct){
	                            tower.repair(critStruct);
	                        }
	                    }else if(Game.cpu.bucket > 9750 && tower.energy > tower.energyCapacity * 0.75 && _.get(tower, 'room.storage.store.energy', 0) > 300000){
	                        var ramparts = _.filter(cluster.structures.rampart, rampart => rampart.pos.roomName == tower.pos.roomName && rampart.getDamage() > 0);
	                        var target = Util.closest(tower, ramparts);
	                        if(target && target.pos.getRangeTo(tower) < 10){
	                            tower.repair(target);
	                        }
	                    }
	                }
	            }
	        });
	        if(Game.interval(500)){
	            Controller.scanForNukes(cluster);
	        }

	        if(Game.intervalOffset(10, 1)){
	            Controller.linkTransfer(cluster);
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
	        let linkInput = _.groupBy(cluster.tagged.input, 'pos.roomName');
	        _.forEach(_.without(cluster.structures.link, cluster.tagged.input), target => {
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
	    static fillRequests(allocated){
	        if(_.size(Memory.state.requests) > 0){
	            var resources = Game.federation.resources;
	            for(let type in Memory.state.requests){
	                if(resources[type].totals.terminal >= 100 && _.some(resources[type].terminal, terminal => terminal.getResource(type) >= 100)){
	                    let requests = Memory.state.requests[type];
	                    let rooms = _.compact(_.map(requests, roomName => Game.rooms[roomName]));
	                    let terminals = _.pick(_.zipObject(rooms, _.map(rooms, 'terminal')), term => term && term.getResource(type) < 3000);
	                    let target = _.min(terminals, terminal => terminal.getResource(type));
	                    if(_.isObject(target)){
	                        let source = _.max(_.filter(resources[type].terminal, terminal => !_.includes(requests, terminal.pos.roomName)
	                                                                                       && !allocated[terminal.id]
	                                                                                       && terminal.getResource(type) >= 100
	                                                                                       && terminal.id != target.id),
	                                           terminal => terminal.getResource(type));
	                        if(_.isObject(source)){
	                            let amount = Math.min(5000 - target.getResource(type), source.getResource(type));
	                            source.send(type, amount, target.pos.roomName);
	                            allocated[source.id] = true;
	                            console.log('Requested', type, 'x', amount, 'sent from', source.pos.roomName, ' -> ', target.pos.roomName);
	                        }
	                    }
	                }
	            }
	        }
	    }

	    static terminalEnergy(allocated){
	        let overfill = _.filter(Game.federation.structures.terminal, terminal => terminal.store.energy < 100000 && _.get(terminal, 'room.storage.store.energy', 999999999) < (terminal.pos.roomName == Memory.levelroom ? 325000 : 250000));
	        let sourceTerminals = _.filter(Game.federation.structures.terminal, terminal => !allocated[terminal.id] && terminal.store.energy > ENERGY_TRANSFER_AMOUNT + 10000 && _.get(terminal, 'room.storage.store.energy', 0) > 350000 && terminal.pos.roomName != Memory.levelroom);
	        let targetClusters = _.filter(Game.clusters, cluster => cluster.totalEnergy < 100000 && cluster.structures.terminal.length > 0);
	        if(sourceTerminals.length > 0){
	            if(targetClusters.length > 0){
	                for(let destCluster of targetClusters){
	                    let targetTerminal = _.first(Util.sort.resource(RESOURCE_ENERGY, destCluster.structures.terminal));
	                    if(targetTerminal.getResource(RESOURCE_ENERGY) < 100000 && sourceTerminals.length > 0){
	                        let closest = Util.closest(targetTerminal, sourceTerminals);
	                        if(closest && closest.send(RESOURCE_ENERGY, ENERGY_TRANSFER_AMOUNT, targetTerminal.pos.roomName) == OK){
	                            console.log('Transferred', ENERGY_TRANSFER_AMOUNT, 'energy from', closest.room.memory.cluster, closest.pos.roomName, 'to', destCluster.id);
	                            closest.room.cluster.profileAdd('transfer', -ENERGY_TRANSFER_AMOUNT);
	                            targetTerminal.room.cluster.profileAdd('transfer', ENERGY_TRANSFER_AMOUNT);
	                            allocated[closest.id] = true;
	                            _.pull(sourceTerminals, closest);
	                        }
	                    }
	                }
	            }else if(overfill.length > 0){
	                for(let target of overfill){
	                    let closest = Util.closest(target, sourceTerminals);
	                    if(closest && closest.send(RESOURCE_ENERGY, ENERGY_TRANSFER_AMOUNT, target.pos.roomName) == OK){
	                        console.log('Overfilled', ENERGY_TRANSFER_AMOUNT, 'energy from', closest.room.memory.cluster, closest.pos.roomName, 'to', target.room.memory.cluster);
	                        closest.room.cluster.profileAdd('transfer', -ENERGY_TRANSFER_AMOUNT);
	                        target.room.cluster.profileAdd('transfer', ENERGY_TRANSFER_AMOUNT);
	                        allocated[closest.id] = true;
	                        _.pull(sourceTerminals, closest);
	                    }
	                }
	            }
	        }
	    }

	    static emptyTerminals(){
	        let terminals = _.filter(Game.federation.structures.terminal, terminal => terminal.room.matrix.underSiege && terminal.getResource(RESOURCE_ENERGY) > 5000 && terminal.getStored() > terminal.getResource(RESOURCE_ENERGY));
	        if(terminals.length){
	            let targets = _.filter(Game.federation.structures.terminal, terminal => !terminal.room.matrix.underSiege && terminal.getStored() < terminal.getCapacity() * 0.8);
	            terminals.forEach(terminal => {
	                let resources = _.pick(terminal.getResourceList(), (amount, type) => amount > 100 && type != RESOURCE_ENERGY);
	                let sending = _.first(_.keys(resources));
	                let target = Util.closest(terminal, targets);
	                if(target && terminal.send(sending, resources[sending], target.pos.roomName) == OK){
	                    console.log('Emptying terminal', terminal.pos.roomName, terminal.room.cluster.id, 'sending', sending, resources[sending], target.pos.roomName);
	                }
	            });
	        }
	    }

	    static levelTerminals(allocated){
	        let terminals = Game.federation.structures.terminal;
	        let terminalCount = terminals.length;
	        let ideal = 5000;
	        let idealTotal = ideal * terminalCount;

	        _.forEach(Game.federation.resources, (data, type)=>{
	            if(type == RESOURCE_ENERGY || data.stored < ideal){
	                return;
	            }

	            let needed = _.filter(terminals, terminal => terminal.getResource(type) < ideal - 100 && !terminal.hasTag('empty'));
	            let excess = _.filter(terminals, terminal => !allocated[terminal.id] && terminal.getResource(type) > ideal + 100 && terminal.getResource(RESOURCE_ENERGY) > 20000);
	            if(needed.length > 0 && excess.length > 0){
	                let source = _.last(Util.sort.resource(type, excess));
	                let destination = _.first(Util.sort.resource(type, needed));
	                let sourceAmount = source.getResource(type);
	                var destinationAmount = destination.getResource(type);
	                var sending = Math.min(sourceAmount - ideal, ideal - destinationAmount);
	                if(sending >= 100){
	                    console.log('Transferring', sending, type, 'from', source.pos.roomName, 'to', destination.pos.roomName);
	                    allocated[source.id] = source.send(type, sending, destination.pos.roomName) == OK;
	                    return;
	                }
	            }
	        });
	    }

	    //// Reactions ////

	    static runReaction(type, data){
	        var cluster = Game.clusterForRoom(data.room);

	        if(!cluster || !cluster.state.labs[data.room]){
	            Game.note('runReactionInvalid', 'invalid reaction/lab! ' + type + ' ' + data.room);
	            return;
	        }
	        var labs = Game.getObjects(cluster.state.labs[data.room]);
	        for(var ix=2; ix<labs.length; ix++){
	            Controller.react(cluster, type, labs[ix], labs[0], labs[1], data.components);
	        }
	    }

	    static react(cluster, type, targetLab, labA, labB, components){
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
	        if(cluster.boost[targetLab.id]){
	            console.log('attempting to manu with boost lab', targetLab);
	            return false;
	        }
	        targetLab.runReaction(labA, labB);
	    }

	    static scanForNukes(cluster){
	        if(Memory.clusters[cluster.id].nukes){
	            delete Memory.clusters[cluster.id].nukes;
	        }
	        var targets = false;
	        var repair = false;
	        for(var room of cluster.roles.core){
	            var nukes = room.find(FIND_NUKES);
	            if(nukes.length > 0){
	                if(!cluster.state.nukes){
	                    Game.note('nuke', 'NUKE DETECTED: '+room.name);
	                }
	                if(!targets){
	                    targets = {};
	                    repair = {};
	                }
	                var structures = room.find(FIND_STRUCTURES);
	                var ramparts = _.filter(structures, struct => struct.structureType == STRUCTURE_RAMPART || struct.structureType == STRUCTURE_WALL);
	                targets[room.name] = _.map(nukes, nuke => {
	                    var inRange = _.filter(ramparts, struct => struct.pos.getRangeTo(nuke) <= 3);
	                    var epicenter = _.first(_.filter(inRange, rampart => rampart.pos.getRangeTo(nuke) == 0));
	                    for(var rampart of inRange){
	                        _.set(repair, rampart.id, _.get(repair, rampart.id, cluster.opts.repair) + 5500000);
	                    }
	                    if(epicenter){
	                        _.set(repair, epicenter.id, _.get(repair, epicenter.id, cluster.opts.repair) + 5500000);
	                    }
	                    return {
	                        landingTick: Game.time + nuke.timeToLand,
	                        pos: nuke.pos,
	                        ramparts: _.map(inRange, 'id'),
	                        epicenter: _.get(epicenter, 'id', false)
	                    };
	                });
	            }
	        }
	        cluster.state.nukes = targets;
	        cluster.state.repair = repair;
	        cluster.update('repair', repair);
	    }

	    static autobuyResources(){
	        if(Game.market.credits < 500000 || Game.cpu.bucket < 7500){
	            return;
	        }
	        Game.perfAdd();
	        var terminals = Game.federation.structures.terminal;
	        var requests = {};
	        for(var terminal of terminals){
	            for(var resource in autobuyPriceLimit){
	                if(terminal.getResource(resource) < 2000 && terminal.getResource(RESOURCE_ENERGY) > 10000){// && !terminal.room.matrix.underSiege){
	                    if(!requests[resource]){
	                        requests[resource] = [];
	                    }
	                    requests[resource].push(terminal);
	                }
	            }
	        }

	        if(_.size(requests) > 0){
	            let orders = Game.market.getAllOrders({ type: ORDER_SELL });
	            let count = 0;
	            for(let resource in requests){
	                if(count < 10 && Game.market.credits > 500000){
	                    let availableOrders = _.filter(orders, order => order.resourceType == resource
	                                                                    && order.price <= autobuyPriceLimit[resource]
	                                                                    && order.amount >= 500);
	                    for(let terminal of requests[resource]){
	                        if(count < 10 && Game.market.credits > 500000 && terminal.getResource(RESOURCE_ENERGY) > 10000){
	                            if(availableOrders.length > 0){
	                                var order = _.first(_.sortBy(availableOrders, 'price'));
	                                if(order && order.amount >= 500){
	                                    let amount = Math.min(2000, order.amount);
	                                    if(Game.market.deal(order.id, amount, terminal.pos.roomName) == OK){
	                                        count++;
	                                        order.amount -= amount;
	                                        console.log('Autobuy', resource, 'for room', terminal.pos.roomName, amount);
	                                    }
	                                }
	                            }
	                        }
	                    }
	                }
	            }
	        }
	        Game.perfAdd('autobuy');
	    }
	}

	module.exports = Controller;

/***/ },
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const config = __webpack_require__(5);

	const workerCtors = {
	    attack: __webpack_require__(14),
	    build: __webpack_require__(16),
	    defend: __webpack_require__(17),
	    deliver: __webpack_require__(18),
	    dismantle: __webpack_require__(19),
	    downgrade: __webpack_require__(20),
	    heal: __webpack_require__(21),
	    idle: __webpack_require__(22),
	    keep: __webpack_require__(23),
	    mine: __webpack_require__(24),
	    observe: __webpack_require__(25),
	    pickup: __webpack_require__(26),
	    repair: __webpack_require__(27),
	    reserve: __webpack_require__(28),
	    transfer: __webpack_require__(29),
	    upgrade: __webpack_require__(30)
	};

	const Behavior = __webpack_require__(31);

	class Worker {

	    static process(cluster){
	        const workers = _.mapValues(workerCtors, ctor => new ctor());
	        const behaviors = Behavior();

	        _.forEach(workers, worker => worker.pretick(cluster));
	        // Game.perfAdd();
	        const creeps = _.filter(cluster.creeps, 'ticksToLive');
	        _.forEach(creeps, Worker.validate.bind(this, workers, behaviors, cluster));
	        // Game.perfAdd('validate');
	        _.forEach(creeps, Worker.work.bind(this, workers, behaviors, cluster));
	        // Game.perfAdd('work');

	        if(Game.interval(20) || cluster.requestedQuota){
	            Worker.generateQuota(workers, cluster);
	        }
	        // Game.perfAdd('quota');
	    }

	    //hydrate, validate, and end jobs
	    static validate(workers, behaviors, cluster, creep){
	        if(creep.memory.cpu === undefined){
	            creep.memory.cpu = 0;
	        }
	        var validateStart = Game.cpu.getUsed();
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
	            var profStart;
	            if(work.profile){
	                profStart = Game.cpu.getUsed();
	            }
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
	            if(work.profile){
	                Game.profileAdd('valid-'+type, Game.cpu.getUsed() - profStart);
	            }
	        }else{
	            creep.job = null;
	        }
	        var validateDelta = Game.cpu.getUsed() - validateStart;
	        Game.profileAdd(creep.memory.type, validateDelta);
	        creep.memory.cpu += validateDelta;
	    }

	    //bid and work jobs
	    static work(workers, behaviors, cluster, creep){
	        var workStart = Game.cpu.getUsed();
	        const workConfig = config[creep.memory.type].work;
	        if(!creep.memory.job){
	            var lowestBid = Infinity;
	            var bidder = _.reduce(workConfig, (result, opts, type) => {
	                if(!workers[type]){
	                    console.log('missing worker', type);
	                    return result;
	                }
	                if(workers[type].profile){
	                    Game.perfAdd();
	                }
	                var bid = workers[type].bid(cluster, creep, opts);
	                if(workers[type].profile){
	                    Game.perfAdd('bid-'+type);
	                }
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
	            }
	        }
	        var behave = _.get(config, [creep.memory.type, 'behavior'], false);
	        if(creep.blocked){
	            behaviors[creep.blocked.type].blocked(cluster, creep, behave[creep.blocked.type], creep.blocked.data);
	        }else{
	            let action = false;
	            if(creep.memory.job && creep.job){
	                let job = creep.job;
	                let type = job.type;
	                if(workers[type].profile){
	                    Game.perfAdd();
	                }
	                action = workers[type].process(cluster, creep, workConfig[type], job, job.target);
	                if(workers[type].profile){
	                    Game.perfAdd('work-'+type);
	                }
	            }
	            _.forEach(behave, (opts, type) => behaviors[type].postWork(cluster, creep, opts, action));
	        }
	        var workDelta = Game.cpu.getUsed() - workStart;
	        Game.profileAdd(creep.memory.type, workDelta);
	        creep.memory.cpu += workDelta;
	        if(creep.memory.cpu > 1200 && !creep.memory.critical){
	            if(creep.ticksToLive > 100){
	                console.log('CPU Exceeded: ' + creep.memory.cluster + ' - ' + creep.name + ' - ' + creep.memory.cpu + ' - ' + creep.ticksToLive);
	                Game.notify('CPU Exceeded: ' + creep.memory.cluster + ' - ' + creep.name + ' - ' + creep.memory.cpu + ' - ' + creep.ticksToLive);
	            }
	            creep.suicide();
	        }
	    }

	    static generateQuota(workers, cluster){
	        var quota = {};
	        var assignments = {};
	        let cores = cluster.getRoomsByRole('core');
	        let keeper = cluster.getRoomsByRole('keep');
	        let harvest = cluster.getRoomsByRole('harvest');

	        _.forEach(workers, worker => worker.calculateQuota(cluster, quota));

	        assignments.spawn = _.zipObject(_.map(cores, 'name'), new Array(cores.length).fill(1));
	        assignments.tower = _.zipObject(_.map(cores, 'name'), new Array(cores.length).fill(1));
	        assignments.harvest = _.zipObject(_.map(harvest, 'name'), _.map(harvest, room => _.size(cluster.find(room, FIND_SOURCES))));
	        for(let keepRoom of keeper){
	            let sources = cluster.find(keepRoom, FIND_SOURCES);
	            let harvestFactor = 1.5;
	            let closest = cluster.findClosestCore(_.first(sources));
	            if(closest){
	                harvestFactor = Math.max(1, 0.5 + Math.min(2, closest.distance / 75));
	            }
	            assignments.harvest[keepRoom.name] = Math.ceil(sources.length * harvestFactor);
	        }
	        for(let coreRoom of cores){
	            if(coreRoom.memory.harvest){
	                assignments.harvest[coreRoom.name] = 1;
	            }
	        }

	        quota.spawnhauler = _.sum(_.map(cores, room => Math.min(1650, room.energyCapacityAvailable)));

	        if(_.size(cluster.structures.storage) > 0){
	            quota.harvesthauler = _.sum(assignments.harvest) * 24;
	        }

	        if(cluster.maxRCL < 5 && cluster.structures.spawn.length > 0){
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
/* 14 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(15);

	const Util = __webpack_require__(10);

	class AttackWorker extends BaseWorker {
	    constructor(){ super('attack', { quota: true, critical: 'attack' }); }

	    /// Job ///

	    attack(cluster, subtype){
	        var targets = [];
	        for(var flag of Flag.getByPrefix('attack')){
	            //TODO fix name ambiguities
	            if(flag.name.includes(cluster.id)){
	                targets.push(flag);
	            }
	        }
	        return this.jobsForTargets(cluster, subtype, targets);
	    }

	    calculateCapacity(cluster, subtype, id, target, args){
	        var parts = target.name.split('-');
	        if(parts.length > 1){
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

	    process(cluster, creep, opts, job, flag){
	        var matrix = Game.matrix.rooms[creep.room.name];
	        var target = false;
	        if(!target){
	            target = _.first(_.sortBy(matrix.hostiles, target => creep.pos.getRangeTo(target)));
	        }
	        if(target){
	            let dist = creep.pos.getRangeTo(target);
	            target.room.visual.circle(target.pos, { radius: 0.5, opacity: 0.25 });
	            target.room.visual.text('HP: '+target.hits, target.pos.x + 5, target.pos.y, { color: '#CCCCCC', background: '#000000' });
	            if(dist < 3){
	                var result = PathFinder.search(creep.pos, { pos: target.pos, range: 3 }, { flee: true });
	                creep.move(creep.pos.getDirectionTo(result.path[0]));
	            }else if(dist > 3){
	                this.attackMove(creep, target);
	            }
	        }else if(creep.pos.getRangeTo(flag) > 3){
	            this.attackMove(creep, flag);
	        }else if(!flag.name.includes('stage')){
	           flag.remove();
	        }
	    }

	}

	module.exports = AttackWorker;

/***/ },
/* 15 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const Pathing = __webpack_require__(2);

	class BaseWorker {
	    constructor(type, opts){
	        this.minCPU = 5000;
	        this.minEnergy = 1000;
	        this.range = 1;
	        this.priority = 0;
	        this.ignoreRoads = false;
	        if(opts){
	            Object.assign(this, opts);
	        }
	        this.type = type;
	    }

	    pretick(cluster){
	        if(this.profile){
	            Game.profileAdd('valid-'+this.type, 0);
	            Game.profileAdd('bid-'+this.type, 0);
	            Game.profileAdd('gen-'+this.type, 0);
	            Game.profileAdd('work-'+this.type, 0);
	        }
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
	        let job = _.get(cluster._hydratedJobs, [this.type, subtype, id]);
	        if(job){
	            job.allocation += allocation;
	        }else{
	            job = this.parseJob(cluster, subtype, id, allocation);
	            job.killed = !this.jobValid(cluster, job);
	            _.set(cluster._hydratedJobs, [this.type, subtype, id], job);
	        }
	        return job;
	    }

	    registerAllocation(cluster, job, allocated){
	        if(!_.has(cluster._hydratedJobs, [job.type, job.subtype, job.id])){
	            _.set(cluster._hydratedJobs, [job.type, job.subtype, job.id], job);
	        }
	        let newAlloc = allocated + _.get(cluster._hydratedJobs, [job.type, job.subtype, job.id, 'allocation'], 0);
	        _.set(cluster._hydratedJobs, [job.type, job.subtype, job.id, 'allocation'], newAlloc);
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
	        if(Game.cpu.bucket < this.minCPU && this.critical != subtype){
	            return [];
	        }
	        var jobs = cluster._jobs[this.type+'-'+subtype];
	        if(!jobs){
	            jobs = this.generateJobsForSubtype(cluster, subtype);
	            cluster._jobs[this.type+'-'+subtype] = jobs;
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
	        var start;
	        if(this.profile){
	            start = Game.cpu.getUsed();
	        }
	        let jobs = this.generateJobs(cluster, subtype);
	        if(this.profile){
	            Game.profileAdd('gen-'+this.type, Game.cpu.getUsed() - start);
	        }
	        let lowestBid = Infinity;
	        return _.reduce(jobs, (result, job) =>{
	            if(job.capacity <= _.get(cluster._hydratedJobs, [this.type, subtype, job.id, 'allocation'], 0)){
	                return result;
	            }
	            let distance = this.ignoreDistance ? 0 : creep.pos.getPathDistance(job.target);
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
/* 16 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(15);

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
/* 17 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	function defendRoom(result, room){
	    var roomData = Game.matrix.rooms[room.name];
	    if(roomData.hostiles.length > 0 && roomData.total.heal < 80 && roomData.total.ranged_attack < 300){
	        result.push(roomData.hostiles);
	    }
	    return result;
	}

	const BaseWorker = __webpack_require__(15);

	class DefendWorker extends BaseWorker {
	    constructor(){ super('defend', { quota: [ 'defend', 'rampart', 'longbow' ], critical: true }); }

	    genTarget(cluster, subtype, id, args){
	        if(subtype == 'defend'){
	            return super.genTarget(cluster, subtype, id, args);
	        }
	        var target = _.get(cluster.defense, [subtype, id]);
	        return target ? { id, pos: new RoomPosition(target.pos.x, target.pos.y, target.pos.roomName) } : undefined;
	    }

	    generateJobsForSubtype(cluster, subtype){
	        if(subtype == 'defend'){
	            return this.defend(cluster, subtype);
	        }
	        return this.jobsForTargets(cluster, subtype, _.map(cluster.defense[subtype], target => {
	            return {
	                id: target.id,
	                pos: new RoomPosition(target.pos.x, target.pos.y, target.pos.roomName)
	            };
	        }));
	    }

	    /// Job ///

	    defend(cluster, subtype){
	        let hostiles = _.reduce(cluster.rooms, defendRoom, []);
	        return this.jobsForTargets(cluster, subtype, _.flatten(hostiles));
	    }

	    /// Creep ///

	    calculateBid(cluster, creep, opts, job, distance){
	        return distance / 50;
	    }

	    processRampart(cluster, creep, opts, job, target){
	        var targetRange = creep.pos.getRangeTo(target.pos);
	        if(targetRange > 1){
	            this.move(creep, target);
	        }else if(targetRange == 1){
	            creep.moveTo(target);
	        }
	        var color = job.subtype == 'longbow' ? '#0000ff' : '#ff0000';
	        var remaining = cluster.state.defcon - Game.time;
	        var tickMessage = (remaining > 0 ? '' + remaining : 'EXP');
	        new RoomVisual(target.pos.roomName)
	            .circle(target.pos, { radius: 0.5, fill: color })
	            .text(tickMessage, target.pos.x, target.pos.y + 1);
	    }

	    process(cluster, creep, opts, job, target){
	        if(job.subtype != 'defend'){
	            return this.processRampart(cluster, creep, opts, job, target);
	        }
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
/* 18 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(15);

	class DeliverWorker extends BaseWorker {
	    constructor(){ super('deliver', { args: ['id', 'resource'], quota: ['stockpile', 'tower'], critical: 'spawn' }); }

	    /// Job ///
	    calculateCapacity(cluster, subtype, id, target, args){
	        return target.getAvailableCapacity();
	    }

	    spawn(cluster, subtype){
	        var structures = cluster.structures.spawn.concat(cluster.structures.extension);
	        var targets = _.filter(structures, struct => struct.energy < struct.energyCapacity);
	        return this.jobsForTargets(cluster, subtype, targets, { resource: RESOURCE_ENERGY });
	    }

	    stockpile(cluster, subtype){
	        var tagged = cluster.getTaggedStructures();
	        return this.jobsForTargets(cluster, subtype, tagged.stockpile, { resource: RESOURCE_ENERGY });
	    }

	    storage(cluster, subtype){
	        var structures = _.filter(cluster.getAllMyStructures([STRUCTURE_STORAGE]), storage => storage.getStored() < storage.getCapacity() * 0.9 && storage.getResource(RESOURCE_ENERGY) < storage.getCapacity() * 0.6);
	        var tagged = cluster.getTaggedStructures();
	        return this.jobsForTargets(cluster, subtype, structures.concat(tagged.stockpile || []), { resource: RESOURCE_ENERGY });
	    }

	    tower(cluster, subtype){
	        var structures = cluster.structures.tower;
	        var targets = _.filter(structures, struct => struct.energy < struct.energyCapacity - 50);
	        return this.jobsForTargets(cluster, subtype, targets, { resource: RESOURCE_ENERGY });
	    }

	    terminal(cluster, subtype){
	        var terminals = _.filter(cluster.getAllMyStructures([STRUCTURE_STORAGE]), storage => storage.getStored() < storage.getCapacity() * 0.9);
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
	        if(job.target && job.target.structureType == 'tower'){
	            return super.jobValid(cluster, job) && job.target.getAvailableCapacity() > 50;
	        }
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
/* 19 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(15);

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
	            let parts = flag.name.split('-');
	            if(flag.room && (_.get(Memory.rooms, [roomName, 'cluster']) == cluster.id || parts[2] == cluster.id)){
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
	        for(var target of targets){
	            target.room.visual.circle(target.pos);
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
	        target.room.visual.circle(target.pos);
	        this.orAttackMove(creep, target, creep.dismantle(target));
	    }

	}

	module.exports = DismantleWorker;

/***/ },
/* 20 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(15);

	class DowngradeWorker extends BaseWorker {
	    constructor(){ super('downgrade', { quota: true, minEnergy: 100000 }); }

	    /// Job ///

	    downgrade(cluster, subtype){
	        var flags = _.filter(Flag.getByPrefix('Downgrade'), flag => flag.name.split('-')[1] == cluster.id && flag.room);
	        _.forEach(flags, flag => {
	            if(!_.get(flag, 'room.controller.owner.username') || _.get(flag, 'room.controller.my')){
	                flag.remove();
	            }
	        });
	        return this.jobsForTargets(cluster, subtype, flags.map(flag => flag.room.controller));
	    }

	    calculateCapacity(cluster, subtype, id, target, args){
	        if(cluster.totalEnergy > 250000){
	            return 2;
	        }
	        return 1;
	    }

	    jobValid(cluster, job){
	        return super.jobValid(cluster, job) && _.get(job, 'target.owner.username', false) && !job.target.my;
	    }

	    /// Creep ///

	    calculateBid(cluster, creep, opts, job, distance){
	        return distance / 50;
	    }

	    process(cluster, creep, opts, job, target){
	        this.orAttackMove(creep, target, creep.attackController(target));
	    }

	}

	module.exports = DowngradeWorker;

/***/ },
/* 21 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(15);

	class HealWorker extends BaseWorker {
	    constructor(){ super('heal', { quota: true, critical: 'heal' }); }

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
/* 22 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(15);

	class IdleWorker extends BaseWorker {
	    constructor(){ super('idle', { priority: 99, critical: true }); }

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
/* 23 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(15);

	class KeepWorker extends BaseWorker {
	    constructor(){ super('keep', { ignoreRoads: true }); }

	    /// Job ///

	    keep(cluster, subtype){
	        if(cluster.maxRCL < 7){
	            return [];
	        }
	        let keeps = cluster.findIn(cluster.roomflags.keep, FIND_HOSTILE_STRUCTURES);
	        return this.jobsForTargets(cluster, subtype, _.reject(keeps, keep => keep.ticksToSpawn > 75));
	    }

	    jobValid(cluster, job){
	        return super.jobValid(cluster, job) && !(job.target.ticksToSpawn > 75 && job.target.ticksToSpawn < 280);
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
/* 24 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(15);

	class MineWorker extends BaseWorker {
	    constructor(){ super('mine', { quota: ['energy', 'mineral'], critical: 'energy' }); }

	    /// Job ///

	    energy(cluster, subtype){
	        var sources = _.filter(cluster.findAll(FIND_SOURCES), source => source.room.memory.role != 'reserve');
	        return this.jobsForTargets(cluster, subtype, sources);
	    }

	    mineral(cluster, subtype){
	        var resources = Game.federation.resources;
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

	    start(cluster, creep, opts, job){
	        creep.memory.mining = creep.getActiveBodyparts('work') * 2;
	    }

	    process(cluster, creep, opts, job, target){
	        if(creep.pos.getRangeTo(target) > 1){
	            this.move(creep, target);
	        }else{
	            creep.harvest(target);
	        }
	        // else if(creep.harvest(target) == OK && job.subtype == 'energy'){
	        //     cluster.longtermAdd('mine', Math.min(target.energy, creep.memory.mining));
	        // }
	    }

	}

	module.exports = MineWorker;

/***/ },
/* 25 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(15);

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
/* 26 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(15);

	class PickupWorker extends BaseWorker {
	    constructor(){ super('pickup', { args: ['id', 'resource'], critical: 'pickup', quota: ['mineral'], minCPU: 4500 }); }

	    /// Job ///
	    calculateCapacity(cluster, subtype, id, target, args){
	        return target.getResource(args.resource);
	    }

	    pickup(cluster, subtype){
	        var energy = _.filter(cluster.findAll(FIND_DROPPED_RESOURCES), { resourceType: RESOURCE_ENERGY });
	        var storage = _.filter(cluster.getAllStructures([STRUCTURE_STORAGE, STRUCTURE_CONTAINER, STRUCTURE_LINK]), struct => struct.getResource(RESOURCE_ENERGY) > 0);
	        var terminals = _.filter(cluster.structures.terminal, terminal => terminal.getResource(RESOURCE_ENERGY) > 60000);
	        return this.jobsForTargets(cluster, subtype, energy.concat(storage).concat(terminals), { resource: RESOURCE_ENERGY });
	    }

	    harvest(cluster, subtype){
	        var targets = _.reduce(cluster.roomflags.harvest, (result, room)=>{
	            var energy = _.filter(cluster.find(room, FIND_DROPPED_RESOURCES), { resourceType: RESOURCE_ENERGY });
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
	        return 0.25 + distance / 50 + Math.max(0, 1 - job.capacity / creep.carryCapacity);
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
/* 27 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(15);

	class RepairWorker extends BaseWorker {
	    constructor(){ super('repair', { requiresEnergy: true, quota: ['repair', 'heavy', 'bunker'], range: 3, ignoreDistance: true, minEnergy: 750, minCPU: 2500 }); }

	    /// Job ///

	    repair(cluster, subtype){
	        return this.jobsForTargets(cluster, subtype, cluster.damaged.moderate);
	    }

	    heavy(cluster, subtype){
	        return this.jobsForTargets(cluster, subtype, cluster.damaged.heavy);
	    }

	    bunker(cluster, subtype){
	        if(cluster.state.repair){
	            return _.reduce(cluster.state.repair, (jobs, repairTarget, repairId) => {
	                var target = Game.getObjectById(repairId);
	                if(target && target.hits < repairTarget){
	                    jobs.push(this.createJob(cluster, subtype, target));
	                }
	                return jobs;
	            }, []);
	        }else{
	            return [];
	        }
	    }

	    jobValid(cluster, job){
	        if(job.subtype == 'bunker' && job.target){
	            var targetHits = _.get(cluster.repair, job.target.id, cluster.opts.repair);
	            return super.jobValid(cluster, job) && job.target.hits < targetHits + 100000;
	        }
	        return super.jobValid(cluster, job) && job.target.getDamage() > 0;
	    }

	    /// Creep ///

	    calculateBid(cluster, creep, opts, job, distance){
	        return job.target.hits / (job.target.getMaxHits() * 4) + (1 - creep.carry.energy / creep.carryCapacity);
	    }

	    process(cluster, creep, opts, job, target){
	        return this.orMove(creep, target, creep.repair(target)) == OK;
	    }

	}

	module.exports = RepairWorker;

/***/ },
/* 28 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(15);

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
	                cluster.changeRole(target.pos.roomName, 'core');
	                delete Memory.rooms[target.pos.roomName].observe;
	                delete Memory.rooms[target.pos.roomName].claim;
	                delete Memory.rooms[target.pos.roomName].reserve;
	            }else{
	                console.log('Could not claim room', target.pos.roomName, 'for cluster', cluster.id, '! result:', result);
	            }
	        }
	        this.orMove(creep, target, creep.reserveController(target));
	    }

	}

	module.exports = ReserveWorker;

/***/ },
/* 29 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(15);
	const Util = __webpack_require__(10);

	class TransferWorker extends BaseWorker {
	    constructor(){ super('transfer', { args: ['id', 'action', 'resource', 'amount'], quota: true, minCPU: 7500 }); }

	    generateResourceTransfers(cluster, type, resource, need, exact){
	        return cluster.structures[type].reduce((result, struct) => {
	            let amount = struct.getResource(resource);
	            if(exact ? amount < need : amount < need - 200){
	                result.push(this.createJob(cluster, 'transfer', struct, { action: 'deliver', resource: resource, amount: need }));
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

	    generateOffloadTransfers(cluster){
	        var onload = cluster.tagged.onload;
	        if(!onload || onload.length == 0){
	            return [];
	        }
	        return _.reduce(cluster.tagged.offload, (result, struct) =>{
	            var resources = struct.getResourceList();
	            for(var type in resources){
	                if(type != RESOURCE_ENERGY && resources[type] > 0){
	                    result.push(this.createJob(cluster, 'transfer', struct, { action: 'offload', resource: type, amount: 0 }));
	                }
	            }
	            return result;
	        }, []);
	    }

	    generateTerminalEnergyTransfers(cluster){
	        return cluster.structures.terminal.reduce((result, struct) => {
	            let energy = struct.getResource(RESOURCE_ENERGY);
	            if(energy > 50000){
	                result.push(this.createJob(cluster, 'transfer', struct, { action: 'store', resource: RESOURCE_ENERGY, amount: 50000 }));
	            }
	            return result;
	        }, []);
	    }

	    generateLabTransfers(cluster){
	        var min = 2400;
	        var max = 2750;
	        return _.reduce(cluster.state.transfer, (result, resource, labId) => {
	            var target = Game.structures[labId];
	            if(!target){
	                console.log('invalid lab', labId, cluster.id);
	                delete cluster.state.transfer[labId];
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
	                    result.push(this.createJob(cluster, 'transfer', target, { action: 'deliver', resource, amount: 2500 }));
	                }
	                if(amount > max){
	                    result.push(this.createJob(cluster, 'transfer', target, { action: 'store', resource, amount: 2500 }));
	                }
	            }
	            return result;
	        }, []);
	    }

	    /// Job ///

	    transfer(cluster, subtype){
	        let jobLists = [];
	        jobLists.push(this.generateResourceTransfers(cluster, STRUCTURE_LAB, RESOURCE_ENERGY, 2000));
	        jobLists.push(this.generateResourceTransfers(cluster, STRUCTURE_TERMINAL, RESOURCE_ENERGY, 50000));
	        jobLists.push(this.generateLabTransfers(cluster));
	        if(cluster.structures.terminal.length > 0){
	            jobLists.push(this.generateTerminalTransfers(cluster));
	            jobLists.push(this.generateTerminalEnergyTransfers(cluster));
	            jobLists.push(this.generateOffloadTransfers(cluster));
	        }
	        if(cluster.structures.nuker.length > 0){
	            jobLists.push(this.generateResourceTransfers(cluster, STRUCTURE_NUKER, RESOURCE_ENERGY, 300000, true));
	            jobLists.push(this.generateResourceTransfers(cluster, STRUCTURE_NUKER, RESOURCE_GHODIUM, 5000, true));
	        }
	        return _.flatten(jobLists);
	    }

	    jobValid(cluster, job){
	        if(!super.jobValid(cluster, job)){
	            return false;
	        }
	        var resource = job.args.resource;
	        var targetResources = job.target.getResource(resource);
	        if(job.args.action == 'store' || job.args.action == 'offload'){
	            return targetResources > job.args.amount;
	        }else if(job.args.action == 'deliver'){
	            return targetResources < job.args.amount && cluster.resources[resource].stored > 0;
	        }else if(job.args.action == 'terminal'){
	            return cluster.resources[resource].totals.terminal < job.args.amount && cluster.resources[resource].totals.storage > 0;
	        }
	    }

	    validate(cluster, creep, opts, target, job){
	        var resource = job.args.resource;
	        var currentResources = creep.getResource(resource);
	        var targetResources = job.target.getResource(resource);
	        if(job.args.action == 'store' || job.args.action == 'offload'){
	            if(currentResources > 0){
	                return true;
	            }else{
	                return targetResources > job.amount;
	            }
	        }else if(job.args.action == 'deliver'){
	            if(currentResources > 0){
	                return targetResources < job.amount;
	            }else{
	                return targetResources < job.amount && cluster.resources[resource].stored > 0;
	            }
	        }else if(job.args.action == 'terminal'){
	            if(currentResources > 0){
	                return cluster.resources[resource].totals.terminal < job.amount;
	            }else{
	                return cluster.resources[resource].totals.terminal < job.amount && cluster.resources[resource].totals.stored > 0;
	            }
	        }
	        console.log('invalid type', job.id, creep, job.args.action);
	        return false;
	    }

	    /// Creep ///

	    // continueJob(cluster, creep, opts, job){
	    //     return super.continueJob(cluster, creep, opts, job) && this.validate(cluster, creep, opts, job.target, job);
	    // }

	    canBid(cluster, creep, opts){
	        return creep.ticksToLive > 100;
	    }

	    keepDeadJob(cluster, creep, opts, job){
	        var resource = job.args.resource;
	        var current = creep.getResource(resource);
	        if(job.args.action == 'store' || job.args.action == 'terminal' || job.args.action == 'offload'){
	            return current > 0;
	        }else if(job.args.action == 'deliver'){
	            return current > 0 && job.target && job.target.getResource(resource) < job.args.amount;
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
	            if(creep.transfer(deliver.target, type, deliver.amount) == OK){
	                creep.memory.job = false;
	                creep.memory.jobType = false;
	            }
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
	        if(action == 'store' || job.args.action == 'offload'){
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
	        if(job.args.action == 'offload'){
	            target = Util.closest(creep, cluster.tagged.onload);
	        }else if(action == 'store'){
	            var terminalIdeal = 5000 * _.size(cluster.structures.terminal);
	            if(type != RESOURCE_ENERGY && cluster.resources[type].totals.terminal + resources <= terminalIdeal + 10000){
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
/* 30 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(15);

	class UpgradeWorker extends BaseWorker {
	    constructor(){ super('upgrade', { requiresEnergy: true, quota: true, range: 3 }); }

	    /// Job ///
	    calculateCapacity(cluster, subtype, id, target, args){
	        if(cluster.totalEnergy < 2000 && target.ticksToDowngrade > 5000){
	            return 5;
	        }
	        if(target.level >= 8){
	            return 15;
	        }
	        if(cluster.maxRCL <= 2){
	            return 5;
	        }
	        if(cluster.maxRCL < 4){
	            return 15;
	        }
	        if(target.level < 4){
	            return 30;
	        }
	        if(Memory.levelroom != target.pos.roomName || Memory.siegemode){
	            return 15;
	        }
	        let energy = _.get(target, 'room.storage.store.energy', 0);
	        return Math.max(1, Math.floor(energy / 100000)) * 15;
	    }

	    upgrade(cluster, subtype){
	        let controllers = _.map(cluster.getRoomsByRole('core'), 'controller');
	        return this.jobsForTargets(cluster, subtype, _.filter(controllers, target => !Memory.siegemode
	                                            || target.level < 8
	                                            || target.ticksToDowngrade < 145000
	                                            || cluster.totalEnergy > 400000 * cluster.structures.storage.length));
	    }

	    /// Creep ///

	    allocate(cluster, creep, opts){
	        return creep.getActiveBodyparts('work');
	    }

	    calculateBid(cluster, creep, opts, job, distance){
	        return distance / 50 + (1 - creep.carry.energy / creep.carryCapacity);
	    }

	    process(cluster, creep, opts, job, target){
	        // var result = 
	        this.orMove(creep, target, creep.upgradeController(target));
	        // if(result == OK){
	        //     cluster.longtermAdd('upgrade', creep.memory.jobAllocation);
	        // }
	    }

	}

	module.exports = UpgradeWorker;

/***/ },
/* 31 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var Avoid = __webpack_require__(32);
	var Boost = __webpack_require__(34);
	var Defend = __webpack_require__(35);
	var Energy = __webpack_require__(36);
	var MinecartAction = __webpack_require__(37);
	var Rampart = __webpack_require__(38);
	var Repair = __webpack_require__(39);
	var SelfHeal = __webpack_require__(40);

	module.exports = function(){
	    return {
	        avoid: new Avoid(),
	        boost: new Boost(),
	        defend: new Defend(),
	        energy: new Energy(),
	        minecart: new MinecartAction(),
	        rampart: new Rampart(),
	        repair: new Repair(),
	        selfheal: new SelfHeal()
	    };
	};

/***/ },
/* 32 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(33);

	class AvoidAction extends BaseAction {
	    constructor(){
	        super('avoid');
	        this.range = 6;
	    }

	    shouldBlock(cluster, creep, opts){
	        var idle = false;
	        if(creep.memory.gather){
	            var gather = creep.memory.gather;
	            var originalRoom = Game.matrix.rooms[creep.memory.fleeFrom];
	            if(originalRoom && originalRoom.hostiles.length == 0){
	                delete creep.memory.gather;
	                delete creep.memory.gatherRange;
	                delete creep.memory.fleeFrom;
	                delete creep.memory.snuggled;
	            }else{
	                let target = new RoomPosition(gather.x, gather.y, gather.roomName);
	                return { type: this.type, data: { gather: true, target, range: creep.memory.gatherRange } };
	            }
	        }
	        var roomData = Game.matrix.rooms[creep.room.name];
	        if(roomData.safemode || (roomData.armed.length == 0 && !roomData.keeper)){
	            return false;
	        }
	        var hostiles = roomData.armed;
	        if(roomData.keeper){
	            let keeps = _.filter(cluster.find(creep.room, FIND_HOSTILE_STRUCTURES), keep => keep.ticksToSpawn < 10);
	            if(keeps.length > 0){
	                hostiles = hostiles.concat(keeps);
	            }
	        }
	        if(hostiles.length > 0){
	            if(roomData.fleeTo){
	                creep.memory.gather = roomData.fleeTo;
	                creep.memory.gatherRange = roomData.fleeToRange;
	                creep.memory.fleeFrom = creep.room.name;
	                return { type: this.type, data: { gather: true, target: roomData.fleeTo, range: roomData.fleeToRange } };
	            }
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
	        if(block.gather){
	            let distance = creep.pos.getRangeTo(block.target);
	            if(distance > block.range){
	                this.move(creep, { pos: block.target });
	            }else if(distance > 2 && !creep.memory.snuggled){
	                this.move(creep, { pos: block.target });
	                creep.memory.snuggled = true;
	            }
	        }else if(block != 'idle'){
	            var result = PathFinder.search(creep.pos, block, { flee: true, range: this.range });
	            creep.moveByPath(result.path);
	        }
	    }

	}


	module.exports = AvoidAction;

/***/ },
/* 33 */
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

	    attackMove(creep, target){
	        return Pathing.attackMove(creep, target, 1, false);
	    }

	    orAttackMove(creep, target, result){
	        if(result == ERR_NOT_IN_RANGE){
	            this.attackMove(creep, target);
	        }
	        return result;
	    }

	}

	module.exports = BaseAction;

/***/ },
/* 34 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseAction = __webpack_require__(33);
	const Util = __webpack_require__(10);
	const creepsConfig = __webpack_require__(5);

	class BoostAction extends BaseAction {
	    constructor(){
	        super('boost');
	    }

	    shouldBlock(cluster, creep, opts){
	        if(creep.memory.reboost){
	            creep.memory.boost = _.get(creepsConfig, [creep.memory.type, 'boost', creep.memory.version], false);
	            delete creep.memory.reboost;
	        }
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
	        if(creep.memory.boostCluster){
	            cluster = Game.clusters[creep.memory.boostCluster];
	        }
	        var type = _.first(_.keys(creep.memory.boost));
	        var resource = Game.boosts[type];
	        var needed = creep.memory.boost[type];

	        if(!creep.memory.boostlab){
	            var available = cluster.boostMinerals[resource];
	            if(available > 30 * needed){
	                var boostLabs = _.invert(cluster.boost, true);
	                creep.memory.boostlab = _.last(_.sortBy(boostLabs[type], labId => {
	                    var lab = Game.getObjectById(labId);
	                    if(!lab || lab.mineralType != resource){
	                        return 0;
	                    }
	                    return lab.mineralAmount;
	                }));
	            }
	            if(!BoostAction.validateLab(creep.memory.boostlab, resource, needed)){
	                if(!opts.required){
	                    console.log(cluster.id, 'Insufficient resources to boost', creep.name, resource, type);
	                    this.remove(cluster, creep, type);
	                }
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
	            delete creep.memory.boostCluster;
	        }
	        creep.memory.calculateBoost = true;
	    }
	}


	module.exports = BoostAction;

/***/ },
/* 35 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(33);
	var Util = __webpack_require__(10);

	var range = 5;

	class DefendAction extends BaseAction {
	    constructor(){
	        super('defend');
	    }

	    shouldBlock(cluster, creep, opts){
	        // var hostiles = cluster.find(creep.room, FIND_HOSTILE_CREEPS);
	        // if(hostiles.length > 0){
	        //     var targets = _.filter(hostiles, hostile => creep.pos.getRangeTo(hostile) < range && (hostile.getActiveBodyparts(ATTACK) > 0 || hostile.getActiveBodyparts(RANGED_ATTACK) > 0))
	        //     var target = _.first(Util.sort.closest(creep, targets));
	        //     if(target){
	        //         return { type: this.type, data: target };
	        //     }
	        // }
	        return false;
	    }

	    blocked(cluster, creep, opts, block){
	        this.orAttackMove(creep, block, creep.attack(block));
	        if(creep.pos.getRangeTo(block) <= 3 && creep.getActiveBodyparts(RANGED_ATTACK) > 0){
	            creep.rangedAttack(block);
	        }
	    }

	}


	module.exports = DefendAction;

/***/ },
/* 36 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(33);

	var offsets = {
	    container: -1,
	    storage: -1.25,
	    link: -1.5,
	};

	var filter = function(struct){
	    return (struct.structureType == STRUCTURE_CONTAINER
	                || struct.structureType == STRUCTURE_STORAGE
	                || struct.structureType == STRUCTURE_LINK)
	            && struct.getResource(RESOURCE_ENERGY) > 0;
	}

	class EnergyAction extends BaseAction {
	    constructor(){
	        super('energy');
	    }

	    postWork(cluster, creep, opts, action){
	        var storage = creep.getStored();
	        if(storage < creep.carryCapacity * 0.25){
	            var target = false;
	            if(creep.memory.energyPickup){
	                target = Game.getObjectById(creep.memory.energyPickup);
	            }
	            if(!target || target.getResource(RESOURCE_ENERGY) == 0 || creep.pos.getRangeTo(target) > 1){
	                var containers = creep.room.lookForRadius(creep.pos, LOOK_STRUCTURES, 2);
	                var targets = _.filter(containers, filter);
	                target = _.first(_.sortBy(targets, target => offsets[target.structureType] * Math.min(creep.carryCapacity, target.getResource(RESOURCE_ENERGY))));
	                if(target){
	                    creep.memory.energyPickup = target.id;
	                }
	            }
	            if(target){
	                creep.withdraw(target, RESOURCE_ENERGY, Math.min(creep.getCapacity() - storage, target.getResource(RESOURCE_ENERGY)));
	            }
	        }
	    }
	}


	module.exports = EnergyAction;

/***/ },
/* 37 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(33);

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
	            var target = false;
	            if(!creep.memory.containers){
	                var structures = cluster.find(creep.room, FIND_STRUCTURES);
	                var containerList = _.filter(structures, struct => struct.structureType == STRUCTURE_CONTAINER
	                                                                || struct.structureType == STRUCTURE_STORAGE
	                                                                || struct.structureType == STRUCTURE_LINK);
	                creep.memory.containers = _.map(containerList, 'id');
	            }
	            if(creep.memory.cart){
	                target = Game.getObjectById(creep.memory.cart);
	            }
	            if(!target || target.getAvailableCapacity() == 0 || creep.pos.getRangeTo(target) > 2){
	                var containers = Game.getObjects(creep.memory.containers);
	                var targets = _.filter(containers, struct => struct && struct.getAvailableCapacity() > 0 && creep.pos.getRangeTo(struct) <= 2);
	                var nearby = _.sortBy(targets, target => offsets[target.structureType] + Math.max(1, creep.pos.getRangeTo(target)));
	                if(nearby.length > 0){
	                    target = _.first(nearby);
	                    creep.memory.cart = target.id;
	                }
	            }

	            if(target){
	                if(creep.pos.getRangeTo(target) > 1){
	                    this.move(creep, target);
	                }else{
	                    _.forEach(creep.carry, (amount, type)=>{
	                        if(amount > 0){
	                            creep.transfer(target, type);
	                        }
	                    });
	                }
	            }
	        }
	    }
	}


	module.exports = MinecartAction;

/***/ },
/* 38 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(33);
	var Util = __webpack_require__(10);

	class RampartAction extends BaseAction {
	    constructor(){
	        super('rampart');
	    }

	    preWork(cluster, creep, opts){
	        var data = creep.room.matrix;
	        if(data.hostiles.length > 0){
	            var range = opts.range || 1;
	            var targets = _.filter(data.hostiles, hostile => creep.pos.getRangeTo(hostile) <= range);
	            var useMass = range > 1 && _.some(targets, hostile => creep.pos.getRangeTo(hostile) <= 1);
	            var target = _.last(_.sortBy(targets, target => _.get(data, ['targetted', target.id, 'value'], 0) - (target.hits / target.hitsMax)));
	            if(target){
	                if(range > 1){
	                    if(creep.pos.getRangeTo(target) == 1 || useMass){
	                        creep.rangedMassAttack(target);
	                    }else{
	                        creep.rangedAttack(target);
	                    }
	                }else{
	                    creep.attack(target);
	                }
	                if(!data.targetted){
	                    data.targetted = {};
	                }
	                if(!data.targetted[target.id]){
	                    data.targetted[target.id] = {
	                        id: target.id,
	                        value: 0
	                    };
	                }
	                data.targetted[target.id].value++;
	            }
	        }
	    }

	}


	module.exports = RampartAction;

/***/ },
/* 39 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(33);

	class RepairAction extends BaseAction {
	    constructor(){
	        super('repair');
	    }

	    postWork(cluster, creep, opts, action){
	        if(Game.cpu.bucket < 7500){
	            return;
	        }
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
/* 40 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(33);

	class SelfHealAction extends BaseAction {
	    constructor(){
	        super('selfheal');
	    }

	    shouldBlock(cluster, creep, opts){
	        if(opts.auto){
	            if(creep.hits < creep.hitsMax || creep.room.matrix.hostiles.length > 0 || creep.room.hostile){
	                creep.heal(creep);
	            }
	            return false;
	        }
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
/* 41 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var Util = __webpack_require__(10);

	var DEFICIT_START_MIN = 1000;
	var CAPACITY_END_MIN = 500;

	class Production {
	    static process(){
	        if(!Game.interval(25)){
	            return;
	        }
	        if(!Memory.state.reaction){
	            Memory.state.reaction = {};
	        }
	        var resources = Game.federation.resources;
	        var targetAmount = _.size(Game.federation.structures.terminal) * 5000;
	        var resourceList = _.values(REACTIONS.X);
	        var quota = _.zipObject(resourceList, _.map(resourceList, type => targetAmount));
	        quota.G = targetAmount;
	        // quota.XUH2O = targetAmount * 2;
	        quota.XKHO2 = targetAmount + 5000;
	        // quota.XLHO2 = targetAmount * 2;
	        // quota.XZHO2 = targetAmount * 2;
	        // quota.XGHO2 = targetAmount * 2;

	        var reactions = {};
	        _.forEach(quota, (amount, type) => {
	            Production.generateReactions(type, amount - resources[type].total, reactions, true, resources);
	        });

	        Memory.stats.reaction = _.sum(_.map(reactions, reaction => Math.max(0, reaction.deficit)));
	        Memory.state.requests = {};
	        // console.log(JSON.stringify(_.mapValues(_.pick(reactions, reaction => reaction.deficit > 0), 'deficit')));

	        for(let type in Memory.state.reaction){
	            let deficit = _.get(reactions, [type, 'deficit'], 0);
	            let capacity = _.get(reactions, [type, 'capacity'], 0);
	            if(deficit <= 0 || capacity <= CAPACITY_END_MIN){
	                console.log('Ending reaction:', type, '-', deficit, 'of', capacity);
	                delete Memory.state.reaction[type];
	            }else{
	                Production.updateReaction(type, Memory.state.reaction[type], reactions[type]);
	            }
	        }

	        var runnableReactions = _.filter(reactions, (reaction, type) => reaction.capacity >= DEFICIT_START_MIN
	                                                                     && reaction.deficit >= DEFICIT_START_MIN
	                                                                     && !Memory.state.reaction[type]);
	        if(runnableReactions.length > 0){

	            var freeRooms = Production.getOpenRooms();
	            if(freeRooms.length > 0){
	                var sortedReactions = _.sortBy(runnableReactions, (reaction) => -Math.min(reaction.deficit, reaction.capacity));
	                for(let reaction of sortedReactions){
	                    if(freeRooms.length > 0){
	                        var targetRoom = _.first(freeRooms);
	                        console.log('Starting reaction:', reaction.type, 'x', Math.min(reaction.deficit, reaction.capacity), 'in', targetRoom);
	                        _.pull(freeRooms, targetRoom);
	                        Production.startReaction(reaction.type, reaction, targetRoom);
	                    }
	                }
	            }
	        }

	        _.forEach(Game.clusters, Production.updateLabTransfers);
	    }

	    static getOpenRooms(){
	        return _.difference(_.flatten(_.compact(_.map(Game.clusters, cluster => _.keys(cluster.state.labs)))), _.map(Memory.state.reaction, 'room'));
	    }

	    static updateLabTransfers(cluster){
	        cluster.state.transfer = {};
	        _.forEach(cluster.structures.lab, lab => {
	            cluster.state.transfer[lab.id] = false;
	        });
	        var reactions = _.pick(Memory.state.reaction, reaction => cluster.state.labs[reaction.room] != undefined);
	        _.forEach(reactions, (reaction, type)=>{
	            var labs = cluster.state.labs[reaction.room];
	            _.forEach(labs, (labId, ix)=>{
	                if(ix < reaction.components.length){
	                    let component = reaction.components[ix];
	                    if(!Memory.state.requests[component]){
	                        Memory.state.requests[component] = [];
	                    }
	                    cluster.state.transfer[labId] = component;
	                    Memory.state.requests[component].push(reaction.room);
	                }else{
	                    cluster.state.transfer[labId] = 'store-'+type;
	                }
	            });
	        });
	        _.forEach(cluster.boost, (boost, labId)=>{
	            if(Game.getObjectById(labId)){
	                cluster.state.transfer[labId] = Game.boosts[boost];
	            }else{
	                console.log('Deleting boost ' + boost + ' for lab', labId, cluster.id);
	                Game.notify('Deleting boost ' + boost + ' for lab ' + labId + ' ' + cluster.id);
	                delete cluster.boost[labId];
	            }
	        });
	    }

	    static startReaction(type, reaction, room){
	        reaction.room = room;
	        Memory.state.reaction[type] = reaction;
	    }

	    static updateReaction(type, reaction, updated){
	        reaction.deficit = updated.deficit;
	        reaction.capacity = updated.capacity;
	        reaction.current = updated.current;
	    }

	    static generateReactions(type, deficit, output, topLevel, resources){
	        if(type.length == 1 && (!topLevel || type != 'G')){
	            return;
	        }
	        var components = Production.findReaction(type);
	        var inventory = _.map(components, component => resources[component].total);
	        _.forEach(inventory, (amount, ix) =>  Production.generateReactions(components[ix], deficit - amount + 500, output, false, resources));

	        if(output[type]){
	            output[type].deficit += deficit;
	        }else{
	            output[type] = { type, components, deficit, capacity: _.min(inventory), current: resources[type].total };
	        }
	    }

	    static findReaction(type){
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