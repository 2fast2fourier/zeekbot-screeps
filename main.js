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
	var Controller = __webpack_require__(5);
	var Spawner = __webpack_require__(7);
	var Worker = __webpack_require__(9);
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
	    Startup.processActions();

	    //// Process ////

	    _.forEach(Game.clusters, (cluster, name) =>{
	        Worker.process(cluster);
	        
	        if(Game.interval(5)){
	            Spawner.process(cluster);
	        }

	        Controller.control(cluster);
	    });

	    Controller.hedgemony();

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
	        profileData = {};
	    }

	    Game.interval = function interval(num){
	        return Game.time % num == 0;
	    };

	    Game.getObjects = function getObjects(idList){
	        return _.map(idList, entity => Game.getObjectById(entity));
	    };

	    Game.note = function note(type, message){
	        if(_.get(Memory, ['notify', type], 0) < Game.time){
	            console.log(message);
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

	    Room.prototype.hasCluster = function(){
	        return this.memory.cluster && Game.clusters[this.memory.cluster];
	    }

	    Room.prototype.getCluster = function(){
	        return Game.clusters[this.memory.cluster];
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
	        return _.filter(Game.flags, flag => flag.name.startsWith(prefix));
	    }

	    Structure.prototype.getMaxHits = function(){
	        //TODO settings
	        return Math.min(this.hitsMax, 250000);
	    }

	    Structure.prototype.getDamage = function(){
	        return Math.max(0, this.getMaxHits() - this.hits);
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
	            Startup.longStats();
	            Startup.shortStats();
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
	            Memory.pathable = {};
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
	        _.forEach(Memory.stats.profile, (value, type)=>console.log(type+':', value));
	        Memory.stats = {
	            profile: {},
	            profileCount: {}
	        }
	    }

	    static longStats(){

	    }

	    static processActions(){
	        if(!Memory.action){
	            return;
	        }
	        console.log('Processing:', Memory.action);
	        let parts = Memory.action.split('-');
	        let roomName = parts[0];
	        let room = Game.rooms[roomName];
	        if(!room){
	            delete Memory.action;
	            console.log('Invalid room:', roomName);
	            return;
	        }
	        switch(parts[1]){
	            case 'newcluster':
	                if(!parts[2]){
	                    console.log('Missing cluster name!');
	                }else{
	                    Cluster.createCluster(parts[2]);
	                    console.log('Created cluster:', parts[2]);
	                }
	                break;
	            case 'assign':
	            //room-assign-Home-harvest
	                let cluster = Game.clusters[parts[2]];
	                if(!cluster){
	                    console.log('Invalid cluster name!', parts[2]);
	                }else if(_.get(Memory, ['rooms', roomName, 'cluster'], false) != parts[2]){
	                    let role = parts.length > 3 ? parts[3] : 'harvest';
	                    Cluster.addRoom(cluster.id, roomName, role);
	                    console.log('Added', roomName, 'to cluster', cluster.id, 'role:', role);
	                }
	                break;
	            case 'reassign':
	                if(!parts[2]){
	                    console.log('Missing cluster name!');
	                }else{
	                    Cluster.addRoom(parts[2], roomName, parts[3]);
	                    _.forEach(room.find(FIND_MY_CREEPS), creep => {
	                        creep.memory.cluster = parts[2];
	                    });
	                    console.log('Reassigned room to cluster:', parts[2], roomName, parts[3]);
	                }
	                break;
	            default:
	                console.log('Unknown action:', parts[1]);
	                break;
	        }
	        console.log('Finished:', Memory.action);
	        delete Memory.action;
	    }
	}

	module.exports = Startup;

/***/ },
/* 3 */
/***/ function(module, exports) {

	"use strict";

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
	            reserve: []
	        };

	        _.forEach(this.rooms, room => {
	            this._roleRooms[room.memory.role].push(room);
	            if(room.energyCapacityAvailable > this.maxSpawn){
	                this.maxSpawn = room.energyCapacityAvailable;
	            }
	            this.maxRCL = Math.max(this.maxRCL, _.get(room, 'controller.level', 0));
	        });
	    }

	    static init(){
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
	    }

	    static createCluster(id){
	        let data = {
	            assignments: {},
	            quota: {},
	            work: {},
	            tags: {}
	        };
	        _.set(Memory, ['clusters', id], data);
	        Game.clusters[id] = new Cluster(id, data, [], []);
	    }

	    static addRoom(clusterId, roomName, role){
	        _.set(Memory, ['rooms', roomName, 'cluster'], clusterId);
	        _.set(Memory, ['rooms', roomName, 'role'], role);
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
	            this._tagged = _.mapValues(this.tags, (list, tag)=>Game.getObjects(list));
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
	const DEFAULT_STUCK_VALUE = 3;
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
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const Util = __webpack_require__(6);

	class Controller {

	    static hedgemony(){
	        if(Game.interval(25)){
	            var buildFlags = Flag.getByPrefix('Build');
	            _.forEach(buildFlags, flag => Controller.buildFlag(flag));
	        }
	    }

	    static control(cluster){

	        _.forEach(cluster.structures.tower, tower=>{
	            let action = false;
	            if(tower.energy >= 10){
	                let hostile = _.first(cluster.find(tower.room, FIND_HOSTILE_CREEPS));
	                if(hostile){
	                    action = tower.attack(hostile) == OK;
	                }
	                if(!action && Game.interval(10)){
	                    let hurtCreep = _.first(_.filter(cluster.find(tower.room, FIND_MY_CREEPS), creep => creep.hits < creep.hitsMax));
	                    if(hurtCreep){
	                        tower.heal(hurtCreep);
	                    }
	                }
	            }
	        });

	        if(Game.interval(10)){
	            Controller.linkTransfer(cluster);
	        }
	        
	        // var towers = catalog.buildings.tower;
	        // var targets = _.map(catalog.jobs.jobs['defend'], 'target');
	        // var healCreeps = _.map(catalog.jobs.jobs['heal'], 'target');
	        // var repairTargets = _.filter(Game.getObjects(Memory.jobs.repair), target => target && target.hits < Math.min(target.hitsMax, Memory.settings.repairTarget) * Memory.settings.towerRepairPercent);
	        // towers.forEach((tower, ix) => {
	        //     if(!Controller.towerDefend(tower, catalog, targets)){
	        //         if(!Controller.towerHeal(tower, catalog, healCreeps) && tower.energy > tower.energyCapacity * 0.75){
	        //             Controller.towerRepair(tower, catalog, repairTargets);
	        //         }
	        //     }
	        // });

	        // if(Util.interval(10, 1)){
	        //     Memory.transfer.reactions = {};
	        //     _.forEach(Memory.reaction, (data, type) => Controller.runReaction(type, data));
	        // }

	        // if(Util.interval(10, 1) || Memory.boost.update){
	        //     Memory.boost.stored = {};
	        //     Memory.boost.labs = {};
	        //     Memory.boost.rooms = {};
	        //     _.forEach(Memory.production.boosts, Controller.boost);
	        //     Memory.boost.update = false;
	        // }
	        

	        // if(Util.interval(20, 1)){
	        //     if(!Controller.levelTerminals(catalog)){
	        //         Controller.sellOverage(catalog);
	        //     }
	        // }

	        // if(catalog.buildings.observer && Game.flags['Watch'] && _.size(catalog.buildings.observer) > 0){
	        //     _.first(catalog.buildings.observer).observeRoom(Game.flags['Watch'].pos.roomName);
	        // }

	        // var ix = 0;
	        // _.forEach(Memory.watch, (time, roomName)=>{
	        //     if(Game.time > time){
	        //         console.log('Ending watch for:', roomName);
	        //         delete Memory.watch[roomName];
	        //     }else if(ix < catalog.buildings.observer.length){
	        //         catalog.buildings.observer[ix].observeRoom(roomName);
	        //         ix++;
	        //     }
	        // });
	    }

	    static buildFlag(flag){
	        if(!flag.room || !flag.room.hasCluster()){
	            Game.note('buildFlagUnknownRoom', 'buildflag in unknown room: ' + flag.pos);
	            flag.remove();
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
	        if(_.get(CONTROLLER_STRUCTURES, [type, rcl], 0) > _.size(cluster.getStructuresByType(flag.room, type))){
	            console.log('Building', type, 'at', flag.pos, rcl);
	            var result = flag.pos.createConstructionSite(type);
	            if(result == OK){
	                flag.remove();
	            }else{
	                Game.note('buildFlagFailed', 'Failed to buildFlag: ' + type + '-' + flag.pos);
	            }
	        }
	    }

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

	    // static runReaction(type, data){
	    //     var labSet = data.lab;
	    //     var labs = Util.getObjects(Memory.production.labs[data.lab]);
	    //     _.forEach(data.components, component => Controller.registerReaction(component, labs[0].pos.roomName));
	    //     for(var ix=2;ix<labs.length;ix++){
	    //         Controller.react(type, labs[ix], labs[0], labs[1], data.components);
	    //     }
	    // }

	    // static registerReaction(type, roomName){
	    //     if(!Memory.transfer.reactions[type]){
	    //         Memory.transfer.reactions[type] = [];
	    //     }
	    //     if(!_.includes(Memory.transfer.reactions[type], roomName)){
	    //         Memory.transfer.reactions[type].push(roomName);
	    //     }
	    // }

	    // static react(type, targetLab, labA, labB, components){
	    //     if(!targetLab || !labA || !labB){
	    //         Util.notify('labnotify', 'invalid lab for reaction: ' + type);
	    //         console.log('invalid lab for reaction: ' + type);
	    //         return false;
	    //     }
	    //     if(targetLab.cooldown > 0 || targetLab.mineralAmount == targetLab.mineralCapacity){
	    //         return;
	    //     }
	    //     if(labA.mineralType != components[0] || labB.mineralType != components[1]){
	    //         return;
	    //     }
	    //     if(labA.mineralAmount == 0 || labB.mineralAmount == 0){
	    //         return;
	    //     }
	    //     targetLab.runReaction(labA, labB);
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

	    // static levelTerminals(catalog){
	    //     var transferred = false;
	    //     var ideal = Memory.settings.terminalIdealResources;
	    //     var terminalCount = _.size(catalog.buildings.terminal);
	    //     _.forEach(catalog.resources, (data, type)=>{
	    //         if(type == RESOURCE_ENERGY || transferred){
	    //             return;
	    //         }
	    //         var reactions = Memory.transfer.reactions[type];
	    //         if(data.totals.terminal > 100 && data.totals.terminal < ideal * terminalCount){
	    //             _.forEach(reactions, roomName=>{
	    //                 if(transferred){
	    //                     return;
	    //                 }
	    //                 var room = Game.rooms[roomName];
	    //                 var targetTerminal = room.terminal;
	    //                 var resources = Util.getResource(targetTerminal, type);
	    //                 if(targetTerminal && resources < ideal - 100 && resources < data.totals.terminal - 100){
	    //                     var source = _.last(Util.sort.resource(_.filter(data.terminal, terminal => !_.includes(reactions, terminal.pos.roomName) && Util.getResource(terminal, type) > 100 && Util.getResource(terminal, RESOURCE_ENERGY) > 20000), type));
	    //                     if(source){
	    //                         var src = Util.getResource(source, type);
	    //                         var dest = Util.getResource(targetTerminal, type);
	    //                         var sending = Math.min(src, ideal - dest);
	    //                         if(sending > 100){
	    //                             transferred = source.send(type, sending, targetTerminal.pos.roomName) == OK;
	    //                         }
	    //                     }
	    //                 }
	    //             });
	    //         }

	    //         if(!transferred && data.totals.terminal > ideal){
	    //             var terminal = _.last(Util.sort.resource(_.filter(data.terminal, terminal => Util.getResource(terminal, type) > ideal + 100 && Util.getResource(terminal, RESOURCE_ENERGY) > 40000), type));
	    //             var targets = _.filter(catalog.buildings.terminal, entity => Util.getResource(entity, type) < ideal - 100);
	    //             var target = _.first(Util.sort.resource(targets, type));
	    //             if(terminal && target){
	    //                 var source = Util.getResource(terminal, type);
	    //                 var dest = Util.getResource(target, type);
	    //                 var sending = Math.min(source - ideal, ideal - dest);
	    //                 if(sending >= 100){
	    //                     transferred = terminal.send(type, sending, target.pos.roomName) == OK;
	    //                     return;
	    //                 }
	    //             }
	    //         }
	    //     });
	    //     return transferred;
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
/* 6 */
/***/ function(module, exports) {

	"use strict";

	class SortPredicates {

	    static storage(entity){
	        return entity.getStorage();
	    }

	    static capacity(entity){
	        return entity.getCapacity() - entity.getStorage();
	    }

	    static resource(type){
	        return function(entity){
	            return entity.getResource(type);
	        }
	    }
	}

	class Sorting {
	    static resource(entities, type){
	        return _.sortBy(entities, SortPredicates.resource(type));
	    }
	    
	    static closest(entity, entities){
	        return _.sortBy(entities, SortPredicates.distance(entity));
	    }
	    
	    static closestReal(entity, entities){
	        return _.sortBy(entities, SortPredicates.distanceReal(entity));
	    }
	}

	module.exports = {
	    sort: Sorting,
	    predicates: {
	        sort: SortPredicates
	    }
	};

/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var creepsConfig = __webpack_require__(8);

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
	        var spawned = false;
	        _.find(cluster.structures.spawn, spawn =>{
	            if(!spawned && Spawner.canSpawn(spawn, spawnlist.parts[type], spawnlist.costs[type])){
	                spawned = Spawner.spawnCreep(cluster, spawn, spawnlist, type);
	            }
	        });
	        return spawned;
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
	            _.forEach(config.parts, (parts, ver) => {
	                let cost = Spawner.calculateCost(parts);
	                if(cost > maxCost && cost <= cluster.maxSpawn){
	                    maxCost = cost;
	                    version = ver;
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
	            alloc = _.get(config, ['parts', version, alloc], 1);
	        }
	        alloc *= _.get(config, 'allocationMulti', 1);
	        return Math.min(alloc, _.get(config, 'allocationMax', Infinity));
	    }

	    static calculateRemainingQuota(cluster, type, config, allocation, version){
	        var perCreep = Spawner.getAllocation(config, version);
	        var quota = Math.min(_.get(cluster.quota, config.quota, 0), _.get(config, 'maxQuota', Infinity));
	        var allocated = _.get(allocation, config.quota, 0);
	        let unmetQuota = quota - allocated;
	        var creepsNeeded = Math.ceil(unmetQuota/perCreep);
	        return creepsNeeded;
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
	                _.set(result, creep.memory.room, _.get(result, creep.memory.room, 0) + (creep.ticksToLive / 1500));
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
	            return false;
	        }
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
/* 8 */
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
	            micro: { tough: 3, move: 11, ranged_attack: 8 },
	            nano: { tough: 5, move: 10, ranged_attack: 5 },
	            pico: { tough: 5, move: 7, ranged_attack: 2 }
	        },
	        work: { defend: {} }
	    },
	    spawnhauler: {
	        quota: 'spawnhauler',
	        critical: true,
	        assignRoom: 'spawn',
	        parts: haulerParts,
	        work: { 
	            pickup: { local: true },
	            deliver: { subtype: 'spawn', local: true }
	        },
	        // behavior: { avoid: {} }
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
	        work: { mine: { subtype: 'energy' } },
	        behavior: { minecart: {} }// avoid: {},
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
	        // behavior: { avoid: {} }
	    },
	    harvesthauler: {
	        quota: 'harvesthauler',
	        allocation: 'carry',
	        parts: haulerParts,
	        assignRoom: 'harvest',
	        work: {
	            pickup: { subtype: 'harvest' },
	            deliver: { subtype: 'storage' }
	        },
	        // behavior: { avoid: {} }
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
	        work: { reserve: {} }
	    },
	    builderworker: {
	        quota: 'build',
	        maxQuota: 10000,
	        allocation: 'work',
	        allocationMulti: 1000,
	        parts: {
	            milli: { move: 10, carry: 6, work: 4 },//1200
	            micro: { move: 7, carry: 5, work: 2 },//800
	            nano: { move: 4, carry: 2, work: 2 },//550
	            pico: { move: 2, carry: 1, work: 1 }//300
	        },
	        work: { pickup: {}, build: {}, repair: { priority: 99 } },
	        // behavior: { avoid: {} }
	    },
	    upgradeworker: {
	        quota: 'upgrade',
	        allocation: 'work',
	        parts: {
	            kilo: { move: 6, carry: 2, work: 10 },//1400
	            milli: { move: 6, carry: 6, work: 5 },//1200
	            micro: { move: 4, carry: 2, work: 5 },//800
	            nano: { move: 3, carry: 4, work: 2 },//550
	            pico: { move: 2, carry: 1, work: 1 }//300
	        },
	        work: { pickup: {}, upgrade: {} },
	        behavior: { energy: {} }
	    },
	    repairworker: {
	        quota: 'repair',
	        allocation: 'work',
	        allocationMulti: 10000,
	        maxQuota: 200000,
	        parts: {
	            milli: { move: 6, carry: 7, work: 5 },//1150
	            micro: { move: 7, carry: 5, work: 2 },//800
	            nano: { move: 5, carry: 4, work: 1 },//550
	            pico: { move: 2, carry: 1, work: 1 }//300
	        },
	        work: { pickup: {}, repair: {} },
	        behavior: { repair: {} }// avoid: {}, 
	    },
	    observer: {
	        quota: 'observe',
	        parts: { pico: { tough: 1, move: 1 } },
	        work: { observe: {} }
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
	    }
	}

/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const config = __webpack_require__(8);

	const workerCtors = {
	    build: __webpack_require__(10),
	    defend: __webpack_require__(12),
	    deliver: __webpack_require__(13),
	    heal: __webpack_require__(29),
	    mine: __webpack_require__(14),
	    observe: __webpack_require__(15),
	    pickup: __webpack_require__(16),
	    repair: __webpack_require__(17),
	    reserve: __webpack_require__(18),
	    upgrade: __webpack_require__(19)
	};

	const Behavior = __webpack_require__(20);

	class Worker {
	    static process(cluster){
	        const workers = _.mapValues(workerCtors, ctor => new ctor());
	        const behaviors = Behavior();
	        const creeps = _.filter(cluster.creeps, 'ticksToLive');
	        _.forEach(creeps, Worker.validate.bind(this, workers, behaviors, cluster));
	        _.forEach(creeps, Worker.work.bind(this, workers, behaviors, cluster));

	        if(Game.interval(20) || cluster.requestedQuota){
	            Worker.generateQuota(workers, cluster);
	        }
	    }

	    //hydrate, validate, and end jobs
	    static validate(workers, behaviors, cluster, creep){
	        if(creep.memory.lx == creep.pos.x && creep.memory.ly == creep.pos.y){
	            creep.memory.sitting = Math.min( 256, creep.memory.sitting * 2);
	        }else{
	            creep.memory.sitting = 1;
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

	    }

	    static generateQuota(workers, cluster){
	        var quota = {};
	        var assignments = {};
	        let cores = cluster.getRoomsByRole('core');
	        let harvest = cluster.getRoomsByRole('harvest');

	        _.forEach(workers, worker => worker.calculateQuota(cluster, quota));

	        assignments.spawn = _.zipObject(_.map(cores, 'name'), new Array(cores.length).fill(1));
	        assignments.harvest = _.zipObject(_.map(harvest, 'name'), _.map(harvest, room => _.size(cluster.find(room, FIND_SOURCES))));

	        quota.spawnhauler = _.sum(assignments.spawn) + 1;

	        if(_.size(cluster.structures.storage) > 0){
	            quota.harvesthauler = _.sum(assignments.harvest) * 24;
	        }

	        if(cluster.maxRCL < 3){
	            quota['stockpile-deliver'] = Math.min(quota['stockpile-deliver'], 500);
	        }

	        cluster.update('quota', quota);
	        cluster.update('assignments', assignments);
	    }
	}

	module.exports = Worker;

/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(11);

	class BuildWorker extends BaseWorker {
	    constructor(){ super('build', { requiresEnergy: true, quota: true, range: 3 }); }

	    /// Job ///
	    calculateCapacity(cluster, subtype, id, target, args){
	        return  target.progressTotal - target.progress;
	    }

	    build(cluster, subtype){
	        return this.jobsForTargets(cluster, subtype, cluster.findAll(FIND_MY_CONSTRUCTION_SITES));
	    }

	    /// Creep ///

	    calculateBid(cluster, creep, opts, job, distance){
	        return distance / 50 + (1 - job.target.progress / job.target.progressTotal);
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
/* 11 */
/***/ function(module, exports) {

	"use strict";

	function whitelistedRooms(roomName){
	    if(Memory.pathable[roomName]){
	        return 2.5;
	    }
	    return undefined;
	}

	class BaseWorker {
	    constructor(type, opts){
	        this.range = 1;
	        if(opts){
	            Object.assign(this, opts);
	        }
	        this.type = type;
	        this.hydratedJobs = {};
	        this.jobs = {};
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
	            return creep.travelTo(target, { allowSK: false, ignoreCreeps: false, range: this.range, routeCallback: whitelistedRooms });
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
	        let lowestBid = Infinity;
	        return _.reduce(jobs, (result, job) =>{
	            if(job.capacity <= _.get(this.hydratedJobs, [this.type, subtype, job.id, 'allocation'], 0)){
	                return result;
	            }
	            let distance = creep.pos.getLinearDistance(job.target);
	            if(opts.local && creep.memory.room && creep.memory.room != _.get(job, 'target.pos.roomName')){
	                return result;
	            }
	            let bid = this.calculateBid(cluster, creep, opts, job, distance);
	            if(bid !== false){
	                bid += _.get(opts, 'priority', 0);
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
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(11);

	class DefendWorker extends BaseWorker {
	    constructor(){ super('defend', { quota: true }); }

	    /// Job ///

	    defend(cluster, subtype){
	        let hostiles = cluster.findAll(FIND_HOSTILE_CREEPS);
	        return this.jobsForTargets(cluster, subtype, _.filter(hostiles, target => _.get(target, 'owner.username', false) != 'Source Keeper'));
	    }

	    calculateCapacity(cluster, subtype, id, target, args){
	        return 1;
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
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(11);

	class DeliverWorker extends BaseWorker {
	    constructor(){ super('deliver', { args: ['id', 'resource'], quota: ['stockpile'] }); }

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
	        var structures = cluster.getAllMyStructures([STRUCTURE_STORAGE]);
	        return this.jobsForTargets(cluster, subtype, structures, { resource: RESOURCE_ENERGY });
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
/* 14 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(11);

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
/* 15 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(11);

	class ObserveWorker extends BaseWorker {
	    constructor(){ super('observe', { quota: true }); }

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
	        if(target.id){
	            return target.id;
	        }else{
	            return target.pos.roomName + '-' + target.pos.x + '-' +target.pos.y;
	        }
	    }

	    observe(cluster, subtype){
	        const targets = _.reduce(Memory.rooms, (result, data, name)=>{
	            if(data.cluster == cluster.id && data.role != 'core'){
	                let targetRoom = Game.rooms[name];
	                let target;
	                if(!targetRoom || !targetRoom.controller){
	                    target = { pos: new RoomPosition(25, 25, name), range: 15 };
	                }else{
	                    target = targetRoom.controller;
	                }
	                result.push(target);
	            }
	            return result;
	        }, []);
	        return this.jobsForTargets(cluster, subtype, targets);
	    }

	    /// Creep ///

	    calculateBid(cluster, creep, opts, job, distance){
	        return distance / 50;
	    }

	    process(cluster, creep, opts, job, target){
	        if(creep.pos.getRangeTo(target) > (target.range || 1)){
	            this.move(creep, target);
	        }
	    }

	}

	module.exports = ObserveWorker;

/***/ },
/* 16 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(11);

	class PickupWorker extends BaseWorker {
	    constructor(){ super('pickup', { args: ['id', 'resource'] }); }

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
	        var targets = _.reduce(cluster.getRoomsByRole('harvest'), (result, room)=>{
	            var energy = cluster.find(room, FIND_DROPPED_ENERGY);
	            var containers = _.filter(cluster.getStructuresByType(room, STRUCTURE_CONTAINER), struct => struct.getResource(RESOURCE_ENERGY) > 0);
	            return result.concat(energy).concat(containers);
	        }, [])
	        return this.jobsForTargets(cluster, subtype, targets, { resource: RESOURCE_ENERGY });
	    }

	    mineral(cluster, subtype){
	        //TODO
	        return [];
	    }

	    /// Creep ///

	    allocate(cluster, creep, opts, job){
	        return creep.getAvailableCapacity();
	    }

	    jobValid(cluster, job){
	        return super.jobValid(cluster, job) && job.target.getResource(job.args.resource) > 0;
	    }

	    continueJob(cluster, creep, opts, job){
	        return super.continueJob(cluster, creep, opts, job) && creep.getAvailableCapacity() > 0;
	    }

	    canBid(cluster, creep, opts){
	        return creep.getAvailableCapacity() > 0;
	    }

	    calculateBid(cluster, creep, opts, job, distance){
	        if(job.target.id == creep.memory.lastDeliver){
	            return false;
	        }
	        return distance / 50 + creep.getStored() / creep.getCapacity() + Math.max(0, 1 - job.capacity / creep.getAvailableCapacity());
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
/* 17 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(11);

	class RepairWorker extends BaseWorker {
	    constructor(){ super('repair', { requiresEnergy: true, quota: true }); }

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
	        return job.target.hits / (job.target.getMaxHits() * 4) + (1 - creep.carry.energy / creep.carryCapacity);
	    }

	    process(cluster, creep, opts, job, target){
	        return this.orMove(creep, target, creep.repair(target)) == OK;
	    }

	}

	module.exports = RepairWorker;

/***/ },
/* 18 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(11);

	class ReserveWorker extends BaseWorker {
	    constructor(){ super('reserve', { quota: true }); }

	    /// Job ///

	    shouldReserve(room){
	        return room.controller && _.get(room, 'controller.reservation.ticksToEnd', 0) < 4000 && !room.controller.my && room.memory.role != 'core';
	    }

	    reserve(cluster, subtype){
	        return this.jobsForTargets(cluster, subtype, _.map(_.filter(cluster.rooms, room => this.shouldReserve(room)), 'controller'));
	    }

	    calculateCapacity(cluster, subtype, id, target, args){
	        return 2;
	    }

	    jobValid(cluster, job){
	        return job.id && job.target;
	    }

	    /// Creep ///

	    continueJob(cluster, creep, opts, job){
	        return super.continueJob(cluster, creep, opts, job) && _.get(job, 'target.reservation.ticksToEnd', 0) < 4800;
	    }

	    keepDeadJob(cluster, creep, opts, job){
	        return job.subtype == 'reserve';
	    }

	    allocate(cluster, creep, opts){
	        return creep.getActiveBodyparts('claim');
	    }

	    calculateBid(cluster, creep, opts, job, distance){
	        return _.get(job, 'target.reservation.ticksToEnd', 0) / 5000;
	    }

	    process(cluster, creep, opts, job, target){
	        if(Game.interval(25)){
	            let flag = Game.flags['Claim'];
	            if(flag && creep.pos.getRangeTo(target) <= 1 && flag.pos.roomName == target.pos.roomName){
	                let result = creep.claimController(target);
	                if(result == OK){
	                    console.log('Claimed room', target.pos.roomName, 'for cluster', cluster.id);
	                    cluster.changeRole(target.pos.roomName, 'core');
	                }else{
	                    console.log('Could not claim room', target.pos.roomName, 'for cluster', cluster.id, '! result:', result);
	                }
	                flag.remove();
	            }
	        }
	        this.orMove(creep, target, creep.reserveController(target));
	    }

	}

	module.exports = ReserveWorker;

/***/ },
/* 19 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(11);

	class UpgradeWorker extends BaseWorker {
	    constructor(){ super('upgrade', { requiresEnergy: true, quota: true, range: 3 }); }

	    /// Job ///
	    calculateCapacity(cluster, subtype, id, target, args){
	        if(cluster.maxRCL > 4 && target.level < 4){
	            return 15;
	        }
	        if(cluster.maxRCL == 8){
	            return 15;
	        }
	        if(target.level >= 2 && target.progress > 10000){
	            return 10;
	        }
	        return 5;
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
/* 20 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var AssignRoomAction = __webpack_require__(21);
	var Avoid = __webpack_require__(23);
	var Boost = __webpack_require__(24);
	var Energy = __webpack_require__(25);
	var MinecartAction = __webpack_require__(26);
	var Repair = __webpack_require__(27);
	var SelfHeal = __webpack_require__(28);

	module.exports = function(){
	    return {
	        // assignRoom: new AssignRoomAction(),
	        // avoid: new Avoid(),
	        // boost: new Boost(),
	        energy: new Energy(),
	        minecart: new MinecartAction(),
	        repair: new Repair(),
	        selfheal: new SelfHeal()
	    };
	};

/***/ },
/* 21 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(22);

	class AssignRoomAction extends BaseAction {
	    constructor(catalog){
	        super(catalog, 'assignRoom');
	    }

	    preWork(creep, opts){
	        var type = creep.memory.actions.assignRoom.type;
	        var assignments = this.generateAssignedList(type);
	        var least = Infinity;
	        var targetRoom = false;
	        _.forEach(Memory.roomlist[type], (target, roomName) => {
	            var assigned = _.get(assignments, roomName, 0) / target;
	            if(assigned < least){
	                least = assigned;
	                targetRoom = roomName;
	            }
	        });
	        if(targetRoom){
	            creep.memory.room = targetRoom;
	            creep.memory.roomtype = type;
	            console.log('Assigned', creep.name, 'to room', targetRoom, creep.memory.roomtype, least);
	        }
	        delete creep.memory.actions.assignRoom;
	    }

	    generateAssignedList(type){
	        return _.reduce(Game.creeps, (result, creep)=>{
	            if(creep.memory.room && creep.memory.roomtype == type){
	                _.set(result, creep.memory.room, _.get(result, creep.memory.room, 0) + (creep.ticksToLive / 1500));
	            }
	            return result;
	        }, {});
	    }
	}


	module.exports = AssignRoomAction;

/***/ },
/* 22 */
/***/ function(module, exports) {

	"use strict";

	class BaseAction {
	    constructor(type){
	        this.type = type;
	    }

	    preWork(cluster, creep, opts){}

	    shouldBlock(cluster, creep, opts){
	        return false;
	    }

	    postWork(cluster, creep, opts, action){}

	    blocked(cluster, creep, opts, block){}

	    hasJob(creep){
	        return creep.memory.job && creep.memory.jobType;
	    }

	    // getJobTarget(creep){
	    //     var job = this.catalog.jobs.getJob(creep.memory.jobType, creep.memory.jobId);
	    //     if(job && job.target){
	    //         return job.target;
	    //     }
	    //     if(creep.memory.jobId){
	    //         return Game.getObjectById(creep.memory.jobId);
	    //     }
	    //     return false;
	    // }

	}

	module.exports = BaseAction;

/***/ },
/* 23 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(22);

	class AvoidAction extends BaseAction {
	    constructor(catalog){
	        super(catalog, 'avoid');
	        this.range = 6;
	    }

	    shouldBlock(creep, opts){
	        // var avoid = this.catalog.getAvoid(creep.pos);
	        // if(avoid && avoid.length > 0){
	        //     var target = this.getJobTarget(creep);
	        //     var positions = _.filter(avoid, pos => creep.pos.getRangeTo(pos) <= this.range);
	        //     if(positions.length > 0){
	        //         return _.map(positions, position => {
	        //             if(target && target.pos.getRangeTo(position) < this.range && creep.pos.getRangeTo(position) == this.range - 1){
	        //                 creep.memory.blockedUntil = Game.time + 5;
	        //             }
	        //             return { pos: position, range: this.range + 4 };
	        //         });
	        //     }else if(creep.memory.blockedUntil > Game.time){
	        //         return true;
	        //     }
	        // }else if(creep.memory.blockedUntil){
	        //     delete creep.memory.blockedUntil;
	        // }
	        return false;
	    }

	    blocked(creep, opts, block){
	        // if(block === true && creep.memory.blockedUntil > Game.time){
	        //     return;
	        // }
	        // if(block){
	        //     var start = Game.cpu.getUsed();
	        //     creep.memory.avoidUntil = Game.time + 10;
	        //     delete creep.memory._move;
	        //     var result = PathFinder.search(creep.pos, block, { flee: true });
	        //     creep.move(creep.pos.getDirectionTo(result.path[0]));
	        //     this.catalog.profileAdd('avoid', Game.cpu.getUsed() - start);
	        // }
	    }
	}


	module.exports = AvoidAction;

/***/ },
/* 24 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(22);
	var Util = __webpack_require__(6);

	class BoostAction extends BaseAction {
	    constructor(catalog){
	        super(catalog, 'boost');
	    }

	    shouldBlock(creep, opts){
	        if(creep.memory.calculateBoost){
	            creep.memory.boosted = _.countBy(_.filter(creep.body, 'boost'), 'boost');
	            delete creep.memory.calculateBoost;
	        }
	        if(!creep.memory.boost && creep.memory.actions.boost){
	            delete creep.memory.actions.boost;
	        }
	        return creep.memory.boost;
	    }

	    blocked(creep, opts, block){
	        var mineral = _.isString(block) ? block : _.first(block);
	        var labs = Memory.boost.labs[mineral];
	        if(!labs){
	            console.log(creep, 'no lab allocated to boost', mineral);
	            delete creep.memory.boost;
	            return;
	        }
	        if(!creep.memory.boostlab){
	            creep.memory.boostlab = _.get(_.first(Util.sort.closestReal(creep, Util.getObjects(labs))), 'id');
	        }
	        var lab = Game.getObjectById(creep.memory.boostlab);
	        if(lab){
	            if(!lab || lab.mineralType != mineral || lab.mineralAmount < 50){
	                console.log(creep, 'not enough to boost', mineral, lab);
	                delete creep.memory.boost;
	                return;
	            }
	            if(creep.pos.getRangeTo(lab) > 1){
	                creep.moveTo(lab, { reusePath: 50 });
	            }else if(lab.boostCreep(creep) == OK){
	                this.boosted(creep, mineral);
	            }
	        }else{
	            console.log(creep, 'no lab allocated to boost', mineral);
	            delete creep.memory.boost;
	            return;
	        }
	    }

	    boosted(creep, mineral){
	        Memory.boost.update = true;
	        delete creep.memory.boostlab;
	        if(_.isString(creep.memory.boost)){
	            delete creep.memory.boost;
	        }else if(_.isArray(creep.memory.boost)){
	            if(creep.memory.boost.length > 1){
	                creep.memory.boost = _.without(creep.memory.boost, mineral);
	            }else{
	                delete creep.memory.boost;
	            }
	        }else{
	            console.log('boosted err', creep.memory.boost);
	        }
	        creep.memory.calculateBoost = true;
	    }
	}


	module.exports = BoostAction;

/***/ },
/* 25 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(22);

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
/* 26 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(22);

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
/* 27 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(22);

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
/* 28 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(22);

	class SelfHealAction extends BaseAction {
	    constructor(){
	        super('selfheal');
	    }

	    shouldBlock(cluster, creep, opts){
	        return opts.block && creep.hits < creep.hitsMax - 200;
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
/* 29 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	const BaseWorker = __webpack_require__(11);

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
	        this.orMove(creep, target, creep.heal(target));
	    }

	}

	module.exports = HealWorker;

/***/ }
/******/ ]);