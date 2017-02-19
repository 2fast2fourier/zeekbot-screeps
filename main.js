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
	var Startup = __webpack_require__(2);
	var Traveller = __webpack_require__(4);
	var Cluster = __webpack_require__(3);
	var Spawner = __webpack_require__(5);
	var Worker = __webpack_require__(7);
	// var Production = require('./production');

	module.exports.loop = function () {
	    //// Startup ////
	    PathFinder.use(true);
	    Poly();
	    Startup.start();
	    
	    for(var name in Memory.creeps) {
	        if(!Game.creeps[name]) {
	            delete Memory.creeps[name];
	        }
	    }
	    Game.profile('memory', Game.cpu.getUsed());
	    Cluster.init();

	    if(Game.interval(10)){
	        Startup.processFlags();
	    }

	    //// Process ////

	    _.forEach(Game.clusters, (cluster, name) =>{
	        Worker.process(cluster);
	    });

	    if(Game.interval(5)){
	        _.forEach(Game.clusters, (cluster, name) =>{
	            Spawner.process(cluster);
	        });
	    }

	    // if(Game.interval(20)){
	        //TODO fix production to not rely on catalog
	    //     Production.process();
	    // }
	    
	    //// Wrapup ////
	    Game.finishProfile();
	    Game.profile('cpu', Game.cpu.getUsed());

	    if(Game.cpu.bucket < 5000){
	        Util.notify('cpubucket', 'CPU bucket under limit!');
	    }
	    if(Game.cpu.bucket < 600){
	        Util.notify('cpubucketcrit', 'CPU bucket critical!');
	    }
	}

/***/ },
/* 1 */
/***/ function(module, exports) {

	"use strict";
	//contains polyfill-style helper injections to the base game classes.
	var roomRegex = /([WE])(\d+)([NS])(\d+)/;

	var profileData = {};

	let flagsPrefix = {};


	module.exports = function(){
	    ///
	    /// Game Helpers
	    ///
	    Game.profile = function profile(type, value){
	        if(!_.has(Memory.stats.profile, type)){
	            Memory.stats.profile[type] = value;
	            Memory.stats.profileCount[type] = 1;
	        }else{
	            var count = Memory.stats.profileCount[type];
	            Memory.stats.profile[type] = (Memory.stats.profile[type] * count + value)/(count + 1);
	            Memory.stats.profileCount[type]++;
	        }
	    };

	    Game.profileAdd = function profileAdd(type, value){
	        _.set(profileData, type, _.get(profileData, type, 0) + value);
	    }

	    Game.finishProfile = function(){
	        _.forEach(profileData, (value, type) => Game.profile(type, value));
	    }

	    Game.interval = function interval(num, offset){
	        if(offset){
	            return Game.time % num == offset;
	        }
	        return Game.time % num == 0;
	    };

	    Game.getObjects = function getObjects(idList){
	        return _.map(idList, entity => Game.getObjectById(entity));
	    };

	    Game.note = function note(type, message){
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

	    RoomPosition.prototype.getPos = function(){
	        return this;
	    }

	    RoomPosition.prototype.getLinearDistance = function getLinearDistance(entity){
	        var target = entity.getPos();
	        var posA = this.getWorldPosition();
	        var posB = target.getWorldPosition();
	        return Math.max(Math.abs(posA.x - posB.x), Math.abs(posA.y-posB.y));
	    };

	    RoomPosition.prototype.getPathDistance = function getPathDistance(entity){
	        var target = entity.getPos();
	        var roomA = Game.rooms[this.roomName];
	        var roomB = Game.rooms[target.roomName];
	        if(roomA && roomB){
	            return Math.max(getMinDistance(roomA, roomB), this.getLinearDistance(entity));
	        }else{
	            return this.getLinearDistance(target);
	        }
	    }
	    Flag.getByPrefix = function getByPrefix(prefix){
	        if(!flagsPrefix[prefix]){
	            flagsPrefix[prefix] = _.filter(Game.flags, flag => flag.name.startsWith(prefix));
	        }
	        return flagsPrefix[prefix];
	    }

	};

/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	let VERSION = 1;
	let STAT_INTERVAL = 100;

	const Cluster = __webpack_require__(3);

	class Startup {
	    static start(){
	        var ver = _.get(Memory, 'ver', 0);
	        if(ver < VERSION){
	            Startup.migrate(ver);
	        }

	        if(Game.interval(STAT_INTERVAL)){
	            Startup.shortStats();
	            Startup.longStats();
	        }
	    }

	    static convert(){

	    }

	    static migrate(ver){
	        console.log('Migrating from version', ver, 'to', VERSION);
	        switch(ver){
	            case 1:
	            Memory.clusters = {};
	            Memory.uid = 1;
	            if(Memory.memoryVersion){
	                console.log('Converting last-gen memory!');
	                Startup.convert();
	                delete Memory.memoryVersion;
	            }
	            Memory.stats = { profile: {}, profileCount: {}};
	            Memory.jobs = {};
	            //TODO init memory
	            // case 2:
	            //TODO add migration
	            // case 3:
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
	        Game.notify('Successfully migrated from version '+ver+' to '+version);
	    }

	    static shortStats(){

	    }

	    static longStats(){

	    }

	    static processFlags(){
	        let flags = Flag.getByPrefix('act');
	        // console.log(flags, Flag.getByPrefix);
	        _.forEach(flags, flag =>{
	            let parts = flag.name.split('-');
	            switch(parts[1]){
	                case 'newcluster':
	                    if(!parts[2]){
	                        console.log('Missing cluster name!');
	                    }else{
	                        Cluster.createCluster(parts[2]);
	                        console.log('Created cluster:', parts[2]);
	                    }
	                    flag.remove();
	                    break;
	                case 'cluster':
	                    let cluster = Game.clusters[parts[2]];
	                    if(!cluster){
	                        console.log('Invalid cluster name!', parts[2]);
	                    }else{
	                        let role = parts.length > 3 ? parts[3] : 'harvest';
	                        Cluster.addRoom(cluster.id, flag.pos.roomName, role);
	                        console.log('Added', flag.pos.roomName, 'to cluster', cluster.id, 'role:', role);
	                    }
	                    flag.remove();
	                    break;
	                default:
	                    console.log('Unknown action:', parts[1]);
	                    flag.remove();
	                    break;
	            }
	        });
	    }
	}

	module.exports = Startup;

/***/ },
/* 3 */
/***/ function(module, exports) {

	"use strict";

	class Cluster {
	    constructor(id, data, creeps){
	        Object.assign(this, data);
	        this.id = id;
	        this.rooms = _.compact(_.map(_.keys(this.roles), roomName=>Game.rooms[roomName]));
	        this.roleRooms = {};
	        this.spawns = [];
	        this.maxSpawn = 0;
	        this._foundAll = {};
	        this.creeps = creeps;
	        // console.log(JSON.stringify(this));
	        _.forEach(this.rooms, room => {
	            room.cluster = this;
	            room.role = this.roles[room.name];
	            if(!this.roleRooms[room.role]){
	                this.roleRooms[room.role] = [];
	            }
	            this.roleRooms[room.role].push(room);
	            if(room.energyCapacityAvailable > this.maxSpawn){
	                this.maxSpawn = room.energyCapacityAvailable;
	            }
	        });
	    }

	    static init(){
	        var creeps = _.groupBy(Game.creeps, 'memory.cluster');
	        Game.clusters = _.reduce(Memory.clusters, (result, data, name)=>{
	            result[name] = new Cluster(name, data, creeps[name]);
	            return result;
	        }, {});
	        var spawns = _.reduce(Game.spawns, (result, spawn) =>{
	            spawn.cluster = spawn.room.cluster;
	            spawn.cluster.spawns.push(spawn);
	        }, {});
	    }

	    static createCluster(id){
	        let data = {
	            quota: { energyminer: 1, spawnhauler: 1, build: 1, upgrade: 1 },
	            roles: {},
	            work: {}
	        };
	        _.set(Memory, ['clusters', id], data);
	        Game.clusters[id] = new Cluster(id, data, []);
	    }

	    static addRoom(clusterId, roomName, role){
	        Memory.clusters[clusterId].roles[roomName] = role;
	    }

	    findAll(type){
	        let found = this._foundAll[type];
	        if(!found){
	            found = _.flatten(_.map(this.rooms, room => room.find(type)));
	            this._foundAll[type] = found;
	        }
	        return found;
	    }

	    getAllMyStructures(types){
	        return _.filter(this.findAll(FIND_MY_STRUCTURES), struct => _.includes(types, struct.structureType));
	    }

	    getAllStructures(types){
	        return _.filter(this.findAll(FIND_STRUCTURES), struct => _.includes(types, struct.structureType));
	    }

	    updateQuota(quota){
	        console.log('quotas', this.id, JSON.stringify(quota));
	        this.quota = quota;
	        Memory.clusters[this.id].quota = quota;
	    }

	}
	Cluster.prototype.ROLE_CORE = 'core';
	Cluster.prototype.ROLE_HARVEST = 'harvest';
	Cluster.prototype.ROLE_RESERVE = 'reserve';

	module.exports = Cluster;

/***/ },
/* 4 */
/***/ function(module, exports) {

	"use strict";
	/**
	 * https://gist.github.com/bonzaiferroni/bbbbf8a681f071dc13759da8a1be316e
	 */
	// const REPORT_CPU_THRESHOLD = 50;
	const DEFAULT_MAXOPS = 40000;
	const DEFAULT_STUCK_VALUE = 5;
	class Traveler {
	    constructor() {
	        // change this memory path to suit your needs
	        if (!Memory.empire) {
	            Memory.empire = {};
	        }
	        if (!Memory.empire.hostileRooms) {
	            Memory.empire.hostileRooms = {};
	        }
	        this.memory = Memory.empire;
	    }
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
	                if (!options.allowHostile && this.memory.hostileRooms[roomName] &&
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
	            else if (this.memory.hostileRooms[roomName] && !options.allowHostile) {
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
	        // register hostile rooms entered
	        if (creep.room.controller) {
	            if (creep.room.controller.owner && !creep.room.controller.my) {
	                this.memory.hostileRooms[creep.room.name] = creep.room.controller.level;
	            }
	            else {
	                this.memory.hostileRooms[creep.room.name] = undefined;
	            }
	        }
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
	            // let cpu = Game.cpu.getUsed();
	            let ret = this.findTravelPath(creep, destination, options);
	            // travelData.cpu += (Game.cpu.getUsed() - cpu);
	            travelData.count++;
	            // if (travelData.cpu > REPORT_CPU_THRESHOLD) {
	            //     console.log(`TRAVELER: heavy cpu use: ${creep.name}, cpu: ${_.round(travelData.cpu, 2)},\n` +
	            //         `origin: ${creep.pos}, dest: ${destination.pos}`);
	            // }
	            if (ret.incomplete) {
	                console.log(`TRAVELER: incomplete path for ${creep.name}`);
	                if (ret.ops < 2000 && options.useFindRoute === undefined && travelData.stuck < DEFAULT_STUCK_VALUE) {
	                    options.useFindRoute = false;
	                    ret = this.findTravelPath(creep, destination, options);
	                    console.log(`attempting path without findRoute was ${ret.incomplete ? "not" : ""} successful`);
	                }
	            }
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
	        room.find(FIND_CREEPS).forEach((creep) => matrix.set(creep.pos.x, creep.pos.y, 0xff));
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
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var creepsConfig = __webpack_require__(6);

	class Spawner {

	    static process(cluster){
	        var spawnlist = Spawner.generateSpawnList(cluster);
	        // if(_.size(spawnlist.count) > 0){
	        //     console.log(JSON.stringify(spawnlist));
	        // }

	        if(spawnlist.totalCost == 0){
	            return;
	        }

	        if(_.size(spawnlist.critical) > 0){
	            _.find(spawnlist.critical, (count, type)=>Spawner.attemptSpawn(cluster, spawnlist, type, count));
	        }else{
	            //TODO insert boosted here
	            _.find(spawnlist.count, (count, type)=>Spawner.attemptSpawn(cluster, spawnlist, type, count));
	        }

	        // _.forEach(spawnlist.boosted, (boosts, type)=>{
	        //     if(spawned){
	        //         return;
	        //     }
	        //     var boostType = _.first(boosts);
	        //     var rooms = _.get(Memory, ['boost', 'rooms', boostType], false);
	        //     if(rooms){
	        //         _.forEach(rooms, room => {
	        //             if(spawned){
	        //                 return;
	        //             }
	        //             var spawn = _.first(_.filter(Game.spawns, spawn => !spawn.spawning && spawn.pos.roomName == room && Spawner.canSpawn(spawn, spawnlist.parts[type], spawnlist.costs[type])));
	        //             if(spawn){
	        //                 spawned = Spawner.spawnCreep(spawn, spawnlist, type, catalog);
	        //             }
	        //         });
	        //     }
	        // });

	        // _.forEach(Game.spawns, spawn => {
	        //     if(!spawned && !spawn.spawning){
	        //         spawned = Spawner.spawner(spawn, catalog, spawnlist);
	        //     }
	        // });
	    }

	    static attemptSpawn(cluster, spawnlist, type, count){
	        _.find(cluster.spawns, spawn =>{
	            if(Spawner.canSpawn(spawn, spawnlist.parts[type], spawnlist.costs[type])){
	                Spawner.spawnCreep(cluster, spawn, spawnlist, type);
	            }
	        });
	        return true;
	    }

	    static generateSpawnList(cluster){
	        var spawnlist = {
	            boosted: {},
	            costs: {},
	            critical: {},
	            count: {},
	            parts: {},
	            version: {},
	            totalCost: 0
	        };
	        var allocation = Spawner.calculateQuotaAllocation(cluster);

	        _.forEach(creepsConfig, (config, type)=>{
	            let maxCost = 0;
	            let version = false;
	            let partSet = false;
	            _.forEach(config.parts, (parts, type) => {
	                let cost = Spawner.calculateCost(parts);
	                if(cost > maxCost && cost <= cluster.maxSpawn){
	                    maxCost = cost;
	                    version = type;
	                    partSet = parts;
	                }
	            });
	            if(version){
	                const limit = Spawner.calculateSpawnLimit(type, config);
	                const quota = Spawner.calculateRemainingQuota(cluster, type, config, allocation, version);
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
	                    // if(config.boost){
	                    //     spawnlist.boosted[type] = _.keys(config.boost);
	                    // }
	                }
	            }
	        });

	        return spawnlist;
	    }

	    static calculateQuotaAllocation(cluster){
	        var allocation = {};
	        _.forEach(cluster.creeps, creep =>{
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
	            return _.get(config, ['parts', version, alloc], 1);
	        }
	        return alloc;
	    }

	    static calculateRemainingQuota(cluster, type, config, allocation, version){
	        var capacity = _.get(cluster.quota, config.quota, 0);
	        var typeAlloc = Spawner.getAllocation(config, version);
	        var curAlloc = _.get(allocation, config.quota, 0);
	        var creepsNeeded = Math.ceil(capacity/typeAlloc);
	        var existing = Math.ceil(curAlloc/typeAlloc);
	        return Math.min(creepsNeeded, _.get(config, 'max', Infinity)) - existing;
	    }

	    static calculateSpawnLimit(cluster, type, config){
	        var limit = Infinity;
	        // if(version.boost && !version.boostOptional){
	        //     //TODO account for in-progress boosts
	        //     _.forEach(version.boost, (parts, type) =>{
	        //         if(!Memory.boost.labs[type] || _.get(Memory.boost.stored, type, 0) < 500){
	        //             limit = 0;
	        //         }
	        //         limit = Math.min(limit, Math.floor(_.get(Memory.boost.stored, type, 0) / (parts * 30)));
	        //     });
	        //     // console.log(type, limit);
	        // }
	        return limit;
	    }

	    static spawnCreep(cluster, spawn, spawnlist, spawnType){
	        var versionName = spawnlist.version[spawnType];
	        var config = creepsConfig[spawnType];
	        var spawned = spawn.createCreep(spawnlist.parts[spawnType], spawnType+'-'+Memory.uid, Spawner.prepareSpawnMemory(cluster, config, spawnType, versionName));
	        Memory.uid++;
	        console.log(spawn.name, 'spawning', spawned, spawnlist.costs[spawnType], 'for cluster', cluster.id);
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

	        if(config.boost){
	            memory.boost = _.keys(config.boost);
	            if(!_.has(memory, 'behavior.boost')){
	                _.set(memory, 'behavior.boost', {});
	            }
	        }

	        if(config.assignRoom){
	            //TODO assignments from generated roomLists
	            memory.room = _.first(cluster.roleRooms.core).name;
	            memory.roomtype = config.assignRoom;
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

	    // static resetBehavior(catalog){
	    //     var classConvert = {
	    //         keepminer: 'miner',
	    //         keepfighter: 'fighter',
	    //         tender: 'hauler'
	    //     }
	    //     var classFallback = {
	    //         miner: 'milli',
	    //         hauler: 'micro',
	    //         worker: 'repair',
	    //         healer: 'pico',
	    //         fighter: 'melee'
	    //     }
	    //     _.forEach(Game.creeps, creep=>{
	    //         var newClass = _.get(classConvert, creep.memory.class, creep.memory.class);
	    //         var newVer = creep.memory.version;
	    //         var config = _.get(classConfig, newClass, false);
	    //         if(!config){
	    //             console.log('failed to find class', creep.memory.class, creep);
	    //             return;
	    //         }
	    //         var version = _.get(config, ['versions', creep.memory.version], false);
	    //         if(!version){
	    //             newVer = classFallback[newClass];
	    //             version = _.get(config, ['versions', newVer], false);
	    //             if(!version){
	    //                 console.log('failed to find version', creep.memory.version);
	    //                 return;
	    //             }
	    //             console.log('converting from', creep.memory.version, 'to', newVer, creep);
	    //         }
	    //         creep.memory.version = newVer;
	    //         creep.memory.type = newVer + newClass;
	    //         creep.memory.class = newClass;
	    //         creep.memory.rules = version.rules || config.rules;
	    //         creep.memory.actions = version.actions || config.actions;
	    //         creep.memory.jobId = false;
	    //         creep.memory.jobType = false;
	    //         creep.memory.jobAllocation = 0;
	    //         creep.memory.moveTicks = 0;
	    //         var optMemory = version.memory || config.memory;
	    //         if(optMemory){
	    //             _.assign(creep.memory, optMemory);
	    //         }
	    //     });
	    //     Memory.resetBehavior = false;
	    //     console.log("Reset behavior!");
	    // }
	}


	module.exports = Spawner;

/***/ },
/* 6 */
/***/ function(module, exports) {

	"use strict";

	module.exports = {
	    energyminer: {
	        quota: 'energy-mine',
	        critical: true,
	        allocation: 'work',//TODO scale allocation on part/boost
	        parts: {
	            milli: { move: 4, carry: 2, work: 8 },//standard 1100
	            micro: { move: 3, carry: 1, work: 6 },//800
	            nano: { move: 2, carry: 1, work: 4 },//550
	            pico: { move: 1, carry: 1, work: 2 }//300
	        },
	        work: { mine: { subtype: 'energy' } },
	        behavior: { avoid: {}, minecart: {}, drop: {} }
	    },
	    spawnhauler: {
	        quota: 'spawnhauler',
	        critical: true,
	        assignRoom: 'spawn',
	        parts: {
	            full: { carry: 32, move: 16 },//2400
	            micro: { carry: 20, move: 10 },//1500
	            milli: { carry: 10, move: 10 },//1000
	            micro: { carry: 8, move: 8 },//800
	            nano: { carry: 5, move: 5 },//550
	            pico: { carry: 3, move: 3 }//300
	        },
	        work: { 
	            pickup: { local: true },
	            deliver: { subtype: 'spawn', local: true }
	        },
	        behavior: { avoid: {} }
	    },
	    builderworker: {
	        quota: 'build',
	        allocation: 1000,//TODO scale allocation on part/boost
	        max: 4,
	        parts: {
	            milli: { move: 10, carry: 6, work: 4 },//1200
	            micro: { move: 7, carry: 5, work: 2 },//800
	            nano: { move: 3, carry: 4, work: 2 },//550
	            pico: { move: 2, carry: 1, work: 1 }//300
	        },
	        work: { pickup: {}, build: {} },
	        behavior: { avoid: {} }
	    },
	    upgradeworker: {
	        quota: 'upgrade',
	        allocation: 'work',
	        parts: {
	            milli: { move: 10, carry: 6, work: 4 },//1200
	            micro: { move: 7, carry: 5, work: 2 },//800
	            nano: { move: 3, carry: 4, work: 2 },//550
	            pico: { move: 2, carry: 1, work: 1 }//300
	        },
	        work: { pickup: {}, upgrade: {} },
	        behavior: { avoid: {} }
	    }
	}

/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const config = __webpack_require__(6);

	const workerCtors = {
	    build: __webpack_require__(13),
	    deliver: __webpack_require__(11),
	    mine: __webpack_require__(8),
	    pickup: __webpack_require__(10),
	    upgrade: __webpack_require__(12)
	};

	class Worker {
	    static process(cluster){
	        const workers = _.mapValues(workerCtors, ctor => new ctor());
	        const creeps = _.filter(cluster.creeps, 'ticksToLive');
	        _.forEach(creeps, Worker.validate.bind(this, workers, cluster));
	        _.forEach(creeps, Worker.work.bind(this, workers, cluster));

	        if(Game.interval(20) || cluster.requestedQuota){
	            Worker.generateQuota(workers, cluster);
	        }
	    }

	    //hydrate, validate, and end jobs
	    static validate(workers, cluster, creep){
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
	    static work(workers, cluster, creep){
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
	        
	        if(creep.memory.job && creep.job){
	            let job = creep.job;
	            let type = job.type;
	            let result = workers[type].process(cluster, creep, workConfig[type], job, job.target);
	        }

	    }

	    static generateQuota(workers, cluster){
	        var quota = {};
	        _.forEach(workers, worker => worker.calculateQuota(cluster, quota));
	        quota.spawnhauler = 1;
	        cluster.updateQuota(quota);
	    }
	}

	module.exports = Worker;

/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(9);

	class MineWorker extends BaseWorker {
	    constructor(){ super('mine', { quota: ['energy', 'mineral'] }); }

	    /// Job ///

	    energy(cluster, subtype){
	        var sources = cluster.findAll(FIND_SOURCES);
	        return this.jobsForTargets(cluster, subtype, sources);
	    }

	    mineral(cluster, subtype){
	        var minerals = _.filter(cluster.findAll(FIND_MINERALS), mineral => mineral.mineralAmount > 0 && mineral.hasExtractor());
	        return this.jobsForTargets(cluster, subtype, minerals);
	    }

	    calculateCapacity(cluster, subtype, id, target, args){
	        return 6;
	    }

	    /// Creep ///

	    allocate(cluster, creep, opts){
	        return creep.getActiveBodyparts('work');
	    }

	    calculateBid(cluster, creep, opts, job, allocation, distance){
	        return distance / 50;
	    }

	    process(cluster, creep, opts, job, target){
	        if(creep.getStored() > creep.getCapacity() / 2){
	            _.forEach(creep.getResourceList(), (amount, type)=>creep.drop(type, amount));
	        }
	        this.orMove(creep, target, creep.harvest(target));
	    }

	}

	module.exports = MineWorker;

/***/ },
/* 9 */
/***/ function(module, exports) {

	"use strict";

	class BaseWorker {
	    constructor(type, opts){
	        if(opts){
	            Object.assign(this, opts);
	        }
	        this.type = type;
	        this.hydratedJobs = {};
	        this.jobs = {};
	    }

	    parseJob(cluster, subtype, id, allocation){
	        let args = false;
	        let target;
	        if(this.args){
	            args = _.zipObject(this.args, id.split('-'));
	            target = Game.getObjectById(args.id);
	        }else{
	            target = Game.getObjectById(id);
	        }
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

	    createJob(cluster, subtype, target, args){
	        let id;
	        if(this.args){
	            id = _.map(this.args, argName => argName == 'id' ? target.id : args[argName]).join('-');
	        }else{
	            id = target.id
	        }
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
	            return creep.travelTo(target, { allowSK: true });
	        }
	    }

	    orMove(creep, target, result){
	        if(result == ERR_NOT_IN_RANGE){
	            this.move(creep, target);
	        }
	        return result;
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
	        var jobs = this.jobs[subtype];
	        if(!jobs){
	            // console.log('generating jobs for', subtype);
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
	        if(!this.canBid(cluster, creep)){
	            return false;
	        }
	        let subtype = _.get(opts, 'subtype', this.type);
	        let jobs = this.generateJobs(cluster, subtype);
	        let allocation = this.allocate(cluster, creep, opts);
	        let lowestBid = Infinity;
	        return _.reduce(jobs, (result, job) =>{
	            if(job.capacity <= _.get(this.hydratedJobs, [this.type, subtype, job.id, 'allocation'], 0)){
	                return result;
	            }
	            let distance = creep.pos.getLinearDistance(job.target);
	            if(opts.local && creep.memory.room && creep.memory.room != _.get(job, 'target.pos.roomName')){
	                return result;
	            }
	            let bid = this.calculateBid(cluster, creep, opts, job, allocation, distance);
	            if(bid !== false){
	                bid += _.get(opts, 'priority', 0);
	                if(bid < lowestBid){
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
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(9);

	class PickupWorker extends BaseWorker {
	    constructor(){ super('pickup', { args: ['id', 'resource'] }); }

	    /// Job ///
	    calculateCapacity(cluster, subtype, id, target, args){
	        return target.getResource(args.resource);
	    }

	    pickup(cluster, subtype){
	        var energy = cluster.findAll(FIND_DROPPED_ENERGY);
	        return this.jobsForTargets(cluster, subtype, energy, { resource: RESOURCE_ENERGY });
	    }

	    mineral(cluster, subtype){
	        //TODO
	        return [];
	    }

	    /// Creep ///

	    jobValid(cluster, job){
	        return super.jobValid(cluster, job) && job.target.getResource(job.args.resource) > 0;
	    }

	    continueJob(cluster, creep, opts, job){
	        return super.continueJob(cluster, creep, opts, job) && creep.getAvailableCapacity() > 0;
	    }

	    canBid(cluster, creep, opts){
	        return creep.getAvailableCapacity() > 0;
	    }

	    calculateBid(cluster, creep, opts, job, allocation, distance){
	        return distance / 50;
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
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(9);

	class DeliverWorker extends BaseWorker {
	    constructor(){ super('deliver', { args: ['id', 'resource'] }); }

	    /// Job ///
	    calculateCapacity(cluster, subtype, id, target, args){
	        return target.getResource(args.resource);
	    }

	    spawn(cluster, subtype){
	        var structures = _.filter(cluster.getAllMyStructures([STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_TOWER]), struct => struct.getAvailableCapacity() > 0);
	        return this.jobsForTargets(cluster, subtype, structures, { resource: RESOURCE_ENERGY });
	    }

	    storage(cluster, subtype){
	        var structures = cluster.getAllMyStructures([STRUCTURE_STORAGE]);
	        return this.jobsForTargets(cluster, subtype, structures, { resource: RESOURCE_ENERGY });
	    }

	    /// Creep ///

	    jobValid(cluster, job){
	        return super.jobValid(cluster, job) && job.target.getAvailableCapacity() > 0;
	    }

	    continueJob(cluster, creep, opts, job){
	        return super.continueJob(cluster, creep, opts, job) && creep.getResource(job.args.resource) > 0;
	    }

	    canBid(cluster, creep, opts){
	        return creep.getStored() > 0;
	    }

	    calculateBid(cluster, creep, opts, job, allocation, distance){
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
	        }
	    }

	}

	module.exports = DeliverWorker;

/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(9);

	class UpgradeWorker extends BaseWorker {
	    constructor(){ super('upgrade', { requiresEnergy: true, quota: true }); }

	    /// Job ///
	    calculateCapacity(cluster, subtype, id, target, args){
	        return 5;
	    }

	    upgrade(cluster, subtype){
	        return this.jobsForTargets(cluster, subtype, _.map(cluster.roleRooms.core, 'controller'));
	    }

	    /// Creep ///

	    calculateBid(cluster, creep, opts, job, allocation, distance){
	        return distance / 50;
	    }

	    process(cluster, creep, opts, job, target){
	        this.orMove(creep, target, creep.upgradeController(target));
	    }

	}

	module.exports = UpgradeWorker;

/***/ },
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(9);

	class BuildWorker extends BaseWorker {
	    constructor(){ super('build', { requiresEnergy: true, quota: true }); }

	    /// Job ///
	    calculateCapacity(cluster, subtype, id, target, args){
	        return  target.progressTotal - target.progress;
	    }

	    build(cluster, subtype){
	        return this.jobsForTargets(cluster, subtype, cluster.findAll(FIND_MY_CONSTRUCTION_SITES));
	    }

	    /// Creep ///

	    calculateBid(cluster, creep, opts, job, allocation, distance){
	        return distance / 50;
	    }

	    allocate(cluster, creep, opts){
	        return creep.getResource(RESOURCE_ENERGY);
	    }

	    process(cluster, creep, opts, job, target){
	        this.orMove(creep, target, creep.build(target));
	    }

	}

	module.exports = BuildWorker;

/***/ }
/******/ ]);