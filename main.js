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
	var Catalog = __webpack_require__(35);
	var Misc = __webpack_require__(56);
	var Production = __webpack_require__(57);
	var Util = __webpack_require__(2);
	var Traveller = __webpack_require__(58);

	module.exports.loop = function () {
	    PathFinder.use(true);
	    Misc.initMemory();
	    if(!Memory.settings){
	        Misc.setSettings();
	    }
	    Util.profile('memory', Game.cpu.getUsed());
	    
	    Misc.mourn();

	    var catalog = new Catalog();
	    var production = new Production(catalog);

	    if(Util.interval(Memory.settings.updateDelta) || !Memory.stats){
	        Misc.updateStats(catalog);
	    }

	    if(Util.interval(50, 5)){
	        Misc.miscUpdate(catalog);
	    }

	    var startup = Game.cpu.getUsed();
	    catalog.profile('startup', startup);

	    production.process();

	    catalog.jobs.generate();
	    catalog.jobs.allocate();
	    catalog.quota.process();

	    var jobs = Game.cpu.getUsed();
	    catalog.profile('jobs', jobs - startup);
	    
	    WorkManager.process(catalog);

	    var worker = Game.cpu.getUsed();
	    catalog.profile('worker', worker - jobs);

	    Spawner.spawn(catalog);
	    
	    // var spawner = Game.cpu.getUsed();
	    Controller.control(catalog);
	    catalog.profile('controller', Game.cpu.getUsed() - worker);

	    catalog.finishProfile();
	    catalog.profile('cpu', Game.cpu.getUsed());

	    if(Game.cpu.bucket < 5000){
	        Util.notify('cpubucket', 'CPU bucket under limit!');
	    }
	    if(Game.cpu.bucket < 600){
	        Util.notify('cpubucketcrit', 'CPU bucket critical!');
	    }
	}

/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var Util = __webpack_require__(2);

	var prices = {
	    X: 0.45
	}

	class Controller {

	    static control(catalog){
	        var towers = catalog.buildings.tower;
	        var targets = _.map(catalog.jobs.jobs['defend'], 'target');
	        var healCreeps = _.map(catalog.jobs.jobs['heal'], 'target');
	        var repairTargets = _.filter(Util.getObjects(Memory.jobs.repair), target => target && target.hits < Math.min(target.hitsMax, Memory.settings.repairTarget) * Memory.settings.towerRepairPercent);
	        towers.forEach((tower, ix) => {
	            if(!Controller.towerDefend(tower, catalog, targets)){
	                if(!Controller.towerHeal(tower, catalog, healCreeps) && tower.energy > tower.energyCapacity * 0.75){
	                    Controller.towerRepair(tower, catalog, repairTargets);
	                }
	            }
	        });


	        if(Util.interval(10, 1)){
	            Memory.transfer.reactions = {};
	            _.forEach(Memory.linkTransfer, (target, source) => Controller.linkTransfer(source, target, catalog));
	            _.forEach(Memory.reaction, (data, type) => Controller.runReaction(type, data));
	        }

	        if(Util.interval(10, 1) || Memory.boost.update){
	            Memory.boost.stored = {};
	            Memory.boost.labs = {};
	            Memory.boost.rooms = {};
	            _.forEach(Memory.production.boosts, Controller.boost);
	            Memory.boost.update = false;
	        }
	        

	        if(Util.interval(20, 1)){
	            if(!Controller.levelTerminals(catalog)){
	                Controller.sellOverage(catalog);
	            }
	        }
	        if(Util.interval(50, 1)){
	            var buildFlags = catalog.getFlagsByPrefix('Build');
	            _.forEach(buildFlags, flag => Controller.buildFlag(catalog, flag));
	        }

	        // if(catalog.buildings.observer && Game.flags['Watch'] && _.size(catalog.buildings.observer) > 0){
	        //     _.first(catalog.buildings.observer).observeRoom(Game.flags['Watch'].pos.roomName);
	        // }

	        var ix = 0;
	        _.forEach(Memory.watch, (time, roomName)=>{
	            if(Game.time > time){
	                console.log('Ending watch for:', roomName);
	                delete Memory.watch[roomName];
	            }else if(ix < catalog.buildings.observer.length){
	                catalog.buildings.observer[ix].observeRoom(roomName);
	                ix++;
	            }
	        });
	    }

	    static buildFlag(catalog, flag){
	        if(!flag.room){
	            console.log('buildflag in unknown room', flag.pos);
	            flag.remove();
	            return;
	        }
	        var args = flag.name.split('-');
	        var type = args[1];
	        if(!_.has(CONSTRUCTION_COST, type)){
	            console.log('unknown buildflag', type);
	            Util.notify('buildFlagUnknown', 'Unknown buildflag: ' + type + '-' + pos);
	            flag.remove();
	        }
	        var gcl = _.get(flag, 'room.controller.level', 0);
	        if(_.get(CONTROLLER_STRUCTURES, [type, gcl], 0) > _.size(catalog.getStructuresByType(flag.room, type))){
	            console.log('Building', type, 'at', flag.pos, gcl);
	            var result = flag.pos.createConstructionSite(type);
	            if(result == OK){
	                flag.remove();
	            }else{
	                Util.notify('buildFlagFailed', 'Failed to buildFlag: ' + type + '-' + pos);
	            }
	        }
	    }

	    static towerDefend(tower, catalog, targets) {
	        var hostiles = _.filter(targets, target => tower.pos.roomName == target.pos.roomName);
	        if(hostiles.length == 0){
	            return false;
	        }
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

	    static towerHeal(tower, catalog, creeps) {
	        var injuredCreeps = _.filter(creeps, target => tower.pos.roomName == target.pos.roomName);
	        if(injuredCreeps.length > 0) {
	            var injuries = _.sortBy(injuredCreeps, creep => creep.hits / creep.hitsMax);
	            return tower.heal(injuries[0]) == OK;
	        }
	        return false;
	    }

	    static towerRepair(tower, catalog, repairTargets) {
	        if(!tower){
	            Util.notify('towerbug', 'missing tower somehow!?');
	            return;
	        }
	        var targets = _.filter(repairTargets, target => tower && target && tower.pos.roomName == target.pos.roomName);
	        if(targets.length > 0) {
	            var damaged = _.sortBy(targets, structure => structure.hits / Math.min(structure.hitsMax, Memory.settings.repairTarget));
	            tower.repair(damaged[0]);
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
	            Util.notify('invalidlink', 'invalid linkTransfer: ' + source + ' ' + target);
	            console.log('invalid linkTransfer', source, target);
	            return false;
	        }
	        var need = catalog.getAvailableCapacity(target);
	        var sourceEnergy = catalog.getResource(source, RESOURCE_ENERGY);
	        if(source && need >= minimumNeed && source.cooldown == 0 && need > 0 && sourceEnergy > 0){
	            source.transferEnergy(target, Math.min(sourceEnergy, need));
	        }
	    }

	    static runReaction(type, data){
	        var labSet = data.lab;
	        var labs = Util.getObjects(Memory.production.labs[data.lab]);
	        _.forEach(data.components, component => Controller.registerReaction(component, labs[0].pos.roomName));
	        for(var ix=2;ix<labs.length;ix++){
	            Controller.react(type, labs[ix], labs[0], labs[1], data.components);
	        }
	    }

	    static registerReaction(type, roomName){
	        if(!Memory.transfer.reactions[type]){
	            Memory.transfer.reactions[type] = [];
	        }
	        if(!_.includes(Memory.transfer.reactions[type], roomName)){
	            Memory.transfer.reactions[type].push(roomName);
	        }
	    }

	    static react(type, targetLab, labA, labB, components){
	        if(!targetLab || !labA || !labB){
	            Util.notify('labnotify', 'invalid lab for reaction: ' + type);
	            console.log('invalid lab for reaction: ' + type);
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

	    static boost(type, labId){
	        Memory.transfer.lab[labId] = type;
	        var lab = Game.getObjectById(labId);
	        if(!lab){
	            delete Memory.production.boosts[labId];
	            Game.notify('Boost Lab no longer valid: '+labId + ' - ' + type);
	            return;
	        }
	        if(lab.mineralType == type && lab.mineralAmount > 500 && lab.energy > 500){
	            if(!Memory.boost.labs[type]){
	                Memory.boost.labs[type] = [];
	                Memory.boost.rooms[type] = [];
	            }
	            Memory.boost.stored[type] = _.get(Memory.boost.stored, type, 0) + lab.mineralAmount;
	            Memory.boost.labs[type].push(lab.id);
	            Memory.boost.rooms[type].push(lab.pos.roomName);
	        }
	    }

	    static levelTerminals(catalog){
	        var transferred = false;
	        var ideal = Memory.settings.terminalIdealResources;
	        var terminalCount = _.size(catalog.buildings.terminal);
	        _.forEach(catalog.resources, (data, type)=>{
	            if(type == RESOURCE_ENERGY || transferred){
	                return;
	            }
	            var reactions = Memory.transfer.reactions[type];
	            if(data.totals.terminal > 100 && data.totals.terminal < ideal * terminalCount){
	                _.forEach(reactions, roomName=>{
	                    if(transferred){
	                        return;
	                    }
	                    var room = Game.rooms[roomName];
	                    var targetTerminal = room.terminal;
	                    var resources = Util.getResource(targetTerminal, type);
	                    if(targetTerminal && resources < ideal - 100 && resources < data.totals.terminal - 100){
	                        var source = _.last(Util.sort.resource(_.filter(data.terminal, terminal => !_.includes(reactions, terminal.pos.roomName) && Util.getResource(terminal, type) > 100 && Util.getResource(terminal, RESOURCE_ENERGY) > 20000), type));
	                        if(source){
	                            var src = Util.getResource(source, type);
	                            var dest = Util.getResource(targetTerminal, type);
	                            var sending = Math.min(src, ideal - dest);
	                            if(sending > 100){
	                                transferred = source.send(type, sending, targetTerminal.pos.roomName) == OK;
	                            }
	                        }
	                    }
	                });
	            }

	            if(!transferred && data.totals.terminal > ideal){
	                var terminal = _.last(Util.sort.resource(_.filter(data.terminal, terminal => Util.getResource(terminal, type) > ideal + 100 && Util.getResource(terminal, RESOURCE_ENERGY) > 40000), type));
	                var targets = _.filter(catalog.buildings.terminal, entity => Util.getResource(entity, type) < ideal - 100);
	                var target = _.first(Util.sort.resource(targets, type));
	                if(terminal && target){
	                    var source = Util.getResource(terminal, type);
	                    var dest = Util.getResource(target, type);
	                    var sending = Math.min(source - ideal, ideal - dest);
	                    if(sending >= 100){
	                        transferred = terminal.send(type, sending, target.pos.roomName) == OK;
	                        return;
	                    }
	                }
	            }
	        });
	        return transferred;
	    }

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
	    static sellOverage(catalog){
	        var sold = false;
	        var terminalCount = _.size(catalog.buildings.terminal);
	        var ideal = Memory.settings.terminalIdealResources;
	        var max = terminalCount * ideal;
	        var orders = {};
	        _.forEach(Game.market.orders, order =>{
	            if(order.active && order.type == ORDER_SELL){
	                orders[order.resourceType] = order;
	            }
	        });
	        _.forEach(catalog.resources, (data, type)=>{
	            var overage = data.totals.terminal - max;
	            if(!sold && type != RESOURCE_ENERGY && overage > 20000 && Game.market.credits > 10000 && data.totals.storage > 50000){
	                if(!_.has(prices, type)){
	                    console.log('want to sell', type, 'but no price');
	                    return;
	                }
	                var existing = orders[type];
	                if(!existing){
	                    var source = _.first(_.sortBy(data.terminal, terminal => -Util.getResource(terminal, type)));
	                    var holding = Util.getResource(source, type);
	                    console.log('selling from', source.pos.roomName, overage, holding, prices[type]);
	                    sold = Game.market.createOrder(ORDER_SELL, type, prices[type], Math.min(overage, holding), source.pos.roomName) == OK;
	                    if(sold){
	                        console.log('created order', type, Math.min(overage, holding));
	                    }
	                }else if(existing && existing.remainingAmount < 250){
	                    console.log('cancelling order', existing.orderId, existing.remainingAmount, overage);
	                    sold = Game.market.cancelOrder(existing.orderId) == OK;
	                }

	            }
	        });
	    }
	}

	module.exports = Controller;

/***/ },
/* 2 */
/***/ function(module, exports) {

	"use strict";

	var roomRegex = /([WE])(\d+)([NS])(\d+)/;

	function getCapacity(entity){
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
	    
	function getStorage(entity){
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

	function owned(entity){
	    return entity.my || !entity.owner;
	}

	function getResource(entity, type){
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
	    }else if(entity.ghodiumCapacity > 0 && type === RESOURCE_GHODIUM){
	        return entity.ghodium;
	    }else if(entity.resourceType && entity.resourceType == type && entity.amount > 0){
	        return entity.amount;
	    }
	    return 0;
	}

	function getResourceList(entity){
	    var result = {};
	    if(!entity){
	        return result;
	    }
	    if(entity.carryCapacity > 0){
	        return _.pick(entity.carry, amount => amount > 0);
	    }else if(entity.storeCapacity > 0){
	        return _.pick(entity.store, amount => amount > 0);
	    }
	    if(entity.mineralCapacity > 0 && entity.mineralAmount > 0){
	        result[entity.mineralType] = entity.mineralAmount;
	    }
	    if(entity.energyCapacity > 0 && entity.energy > 0){
	        result[RESOURCE_ENERGY] = entity.energy;
	    }
	    if(entity.resourceType && entity.amount > 0){
	        result[entity.resourceType] = entity.amount;
	    }
	    if(entity.ghodiumCapacity > 0 && entity.ghodium > 0){
	        result[RESOURCE_GHODIUM] = entity.ghodium;
	    }
	    return result;
	}

	function interval(num, offset){
	    if(offset){
	        return Game.time % num == offset;
	    }
	    return Game.time % num == 0;
	}

	function getObjects(idList){
	    return _.map(idList, entity => Game.getObjectById(entity));
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

	function calculateRealPosition(pos){
	    if(!Memory.cache){
	        Memory.cache = { roompos: {} };
	    }
	    var roompos = Memory.cache.roompos[pos.roomName];
	    if(!roompos){
	        roompos = cacheRoomPos(pos);
	    }
	    return {
	        x: roompos.x + pos.x,
	        y: roompos.y + pos.y * -roompos.ySign
	    };
	}

	function getRealDistance(entityA, entityB){
	    if(!entityA.pos || !entityB.pos){
	        console.log('invalid positions', entityA, entityB);
	        return Infinity;
	    }
	    var posA = calculateRealPosition(entityA.pos);
	    var posB = calculateRealPosition(entityB.pos);
	    var minDist = getMinDistance(entityA.room, entityB.room);
	    return Math.max(minDist, Math.max(Math.abs(posA.x - posB.x), Math.abs(posA.y-posB.y)));
	}

	function notify(type, message){
	    if(_.get(Memory, ['notify', type], 0) < Game.time){
	        Game.notify(message);
	        _.set(Memory, ['notify', type], Game.time + 5000);
	    }
	}

	function profile(type, value){
	    if(!_.has(Memory.stats.profile.misc, type)){
	        Memory.stats.profile.misc[type] = value;
	        Memory.stats.profile.miscCount[type] = 1;
	    }else{
	        Memory.stats.profile.misc[type] = (Memory.stats.profile.misc[type]*Memory.stats.profile.miscCount[type] + value)/(Memory.stats.profile.miscCount[type]+1);
	        Memory.stats.profile.miscCount[type]++;
	    }
	}

	function lookForArea(room, pos, type, radius){
	    return _.map(room.lookForAtArea(type, Math.max(0, pos.y - radius), Math.max(0, pos.x - radius), Math.min(49, pos.y + radius), Math.min(49, pos.x + radius), true), type);
	}

	class FilterPredicates {

	    static empty(entity){
	        return getStorage(entity) == 0;
	    }

	    static notFull(entity){
	        return getStorage(entity) < getCapacity(entity);
	    }

	    static type(type){
	        return function(entity){
	            return entity.structureType == type;
	        }
	    }

	    static notType(type){
	        return function(entity){
	            return entity.structureType != type;
	        }
	    }

	    static types(types){
	        return function(entity){
	            return _.includes(types, entity.structureType);
	        }
	    }

	    static full(entity){
	        return getStorage(entity) >= getCapacity(entity);
	    }
	}

	class SortPredicates {
	    static distance(entityA){
	        return function(entityB){
	            return entityA.pos.getRangeTo(entityB);
	        }
	    }

	    static distanceReal(entityA){
	        return function(entityB){
	            return getRealDistance(entityA, entityB);
	        }
	    }

	    static storage(entity){
	        return getStorage(entity);
	    }

	    static capacity(entity){
	        return getCapacity(entity) - getStorage(entity);
	    }

	    static resource(type){
	        return function(entity){
	            return getResource(entity, type);
	        }
	    }
	}

	class Filters {
	    static notFull(entities){
	        return _.filter(entities, FilterPredicates.notFull);
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

	class Helpers {

	    static closestNotFull(entity, entities){
	        return _.sortBy(_.filter(entities, FilterPredicates.notFull), SortPredicates.distance(entity));
	    }

	    static firstNotFull(entities){
	        return _.first(_.filter(entities, FilterPredicates.notFull));
	    }
	}

	module.exports = {
	    filter: Filters,
	    sort: Sorting,
	    helper: Helpers,
	    predicates: {
	        filter: FilterPredicates,
	        sort: SortPredicates
	    },
	    getCapacity,
	    getStorage,
	    getResource,
	    getResourceList,
	    getObjects,
	    interval,
	    cacheRoomPos,
	    calculateRealPosition,
	    getRealDistance,
	    notify,
	    lookForArea,
	    owned,
	    profile
	};

/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var classConfig = __webpack_require__(4);

	class Spawner {

	    static spawn(catalog){
	        if(Memory.resetBehavior){
	            Spawner.resetBehavior(catalog);
	        }

	        var spawnlist = Spawner.generateSpawnList(catalog);
	        // if(spawnlist.spawn.upgradeworker){
	        //     console.log('upgrade', spawnlist.spawn.upgradeworker, _.size(catalog.creeps.type['upgradeworker']));
	        // }

	        if(spawnlist.totalCost == 0){
	            return;
	        }

	        var spawned = false;

	        _.forEach(spawnlist.boosted, (boosts, type)=>{
	            if(spawned){
	                return;
	            }
	            var boostType = _.first(boosts);
	            var rooms = _.get(Memory, ['boost', 'rooms', boostType], false);
	            if(rooms){
	                _.forEach(rooms, room => {
	                    if(spawned){
	                        return;
	                    }
	                    var spawn = _.first(_.filter(Game.spawns, spawn => !spawn.spawning && spawn.pos.roomName == room && Spawner.canSpawn(spawn, spawnlist.parts[type], spawnlist.costs[type])));
	                    if(spawn){
	                        spawned = Spawner.spawnCreep(spawn, spawnlist, type, catalog);
	                    }
	                });
	            }
	        });

	        _.forEach(Game.spawns, spawn => {
	            if(!spawned && !spawn.spawning){
	                spawned = Spawner.spawner(spawn, catalog, spawnlist);
	            }
	        });
	    }

	    static generateSpawnList(catalog){
	        var spawnlist = {
	            boosted: {},
	            costs: {},
	            critical: {},
	            spawn: {},
	            parts: {},
	            version: {},
	            class: {},
	            totalCost: 0
	        };
	        var allocation = Spawner.calculateQuotaAllocation(catalog);
	        
	        _.forEach(classConfig, (config, className)=>{
	            _.forEach(config.versions, (version, versionName)=>{
	                var type = versionName+className;
	                var limit = Spawner.calculateSpawnLimit(catalog, type, version, config);
	                var quota = Spawner.calculateRemainingQuota(catalog, type, version, config, allocation);
	                var need = Math.min(limit, quota);
	                if(need > 0){
	                    spawnlist.costs[type] = Spawner.calculateCost(version.parts || config.parts);
	                    if(version.critical){
	                        spawnlist.critical[type] = need;
	                    }
	                    if(version.boost){
	                        spawnlist.boosted[type] = _.keys(version.boost);
	                    }
	                    spawnlist.parts[type] = Spawner.partList(version.parts);
	                    spawnlist.version[type] = versionName;
	                    spawnlist.class[type] = className;
	                    spawnlist.spawn[type] = need;
	                    spawnlist.totalCost += need * spawnlist.costs[type];
	                }
	            });
	        });

	        return spawnlist;
	    }

	    static calculateQuotaAllocation(catalog){
	        var allocation = {};
	        _.forEach(classConfig, (config, className)=>{
	            _.forEach(config.versions, (version, versionName)=>{
	                var type = versionName+className;
	                var spawntime = _.sum(version.parts) * 3;
	                var quota = version.quota || config.quota;
	                if(quota && _.has(catalog.creeps.type, type)){
	                    var allocate = _.get(version, 'allocation', 1);
	                    var count = 0;
	                    _.forEach(catalog.creeps.type[type], creep => {
	                        if(creep.ticksToLive >= spawntime || creep.spawning || !creep.ticksToLive){
	                            count++;
	                        }
	                    });
	                    _.set(allocation, quota, _.get(allocation, quota, 0) + (count * allocate));
	                }

	            });
	        });

	        return allocation;
	    }

	    static calculateRemainingQuota(catalog, type, version, config, allocation){
	        var quota = version.quota || config.quota;
	        if(quota){
	            var capacity = catalog.quota.get(quota);
	            var creepsNeeded = Math.ceil(capacity/_.get(version, 'allocation', 1));
	            var existing = Math.ceil(_.get(allocation, quota, 0)/_.get(version, 'allocation', 1));
	            return Math.min(creepsNeeded, _.get(version, 'max', Infinity)) - existing;
	        }
	        return 0;
	    }

	    static calculateSpawnLimit(catalog, type, version, config){
	        var limit = Infinity;
	        if(version.boost && !version.boostOptional){
	            //TODO account for in-progress boosts
	            _.forEach(version.boost, (parts, type) =>{
	                if(!Memory.boost.labs[type] || _.get(Memory.boost.stored, type, 0) < 500){
	                    limit = 0;
	                }
	                limit = Math.min(limit, Math.floor(_.get(Memory.boost.stored, type, 0) / (parts * 30)));
	            });
	            // console.log(type, limit);
	        }
	        return limit;
	    }

	    static spawner(spawn, catalog, spawnlist){
	        var canSpawnCritical = false;
	        var spawnType = _.findKey(spawnlist.critical, (quota, type)=>{
	            if(Spawner.canSpawn(spawn, spawnlist.parts[type], spawnlist.costs[type])){
	                return true;
	            }else if(spawn.room.energyCapacityAvailable >= spawnlist.costs[type]){
	                canSpawnCritical = true;
	            }
	            return false;
	        });

	        if(!spawnType && !canSpawnCritical){
	            spawnType = _.findKey(spawnlist.spawn, (quota, type)=> Spawner.canSpawn(spawn, spawnlist.parts[type], spawnlist.costs[type]));
	        }

	        if(spawnType){
	            return Spawner.spawnCreep(spawn, spawnlist, spawnType, catalog);
	        }
	        return false;
	    }

	    static spawnCreep(spawn, spawnlist, spawnType, catalog){
	        var className = spawnlist.class[spawnType];
	        var versionName = spawnlist.version[spawnType];
	        var config = classConfig[className];
	        var version = config.versions[versionName];
	        var spawned = spawn.createCreep(spawnlist.parts[spawnType], spawnType+'-'+Memory.uid, Spawner.prepareSpawnMemory(config, version, spawnType, className, versionName));
	        Memory.uid++;
	        var current = _.size(catalog.creeps.type[spawnType]);
	        console.log(spawn.name, 'spawning', spawned, spawnlist.costs[spawnType], '-', current + 1, 'of', current + spawnlist.spawn[spawnType]);
	        return spawned;
	    }

	    static canSpawn(spawn, parts, cost){
	        return spawn.room.energyAvailable >= cost && spawn.canCreateCreep(parts) == OK;
	    }

	    static prepareSpawnMemory(config, version, fullType, className, versionName){
	        var memory = {
	            class: className,
	            type: fullType,
	            version: versionName,
	            jobId: false,
	            jobType: false,
	            jobAllocation: 0,
	            rules: version.rules || config.rules,
	            actions: version.actions || config.actions,
	            moveTicks: 0
	        };

	        if(version.boost){
	            memory.boost = _.keys(version.boost);
	            if(!_.has(memory, 'actions.boost')){
	                _.set(memory, 'actions.boost', {});
	            }
	        }

	        var optMemory = version.memory || config.memory;
	        if(optMemory){
	            _.assign(memory, optMemory);
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
	            creep.memory.moveTicks = 0;
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
/* 4 */
/***/ function(module, exports) {

	"use strict";

	module.exports = {
	    miner: {
	        versions: {
	            energy: {
	                allocation: 7,
	                critical: true,
	                parts: { move: 4, carry: 2, work: 8 }
	            },
	            milli: {
	                allocation: 7,
	                max: 0,
	                parts: { move: 4, carry: 2, work: 8 }
	            },
	            mineral: {
	                allocation: 5,
	                quota: 'mine-mineral',
	                parts: { move: 5, carry: 2, work: 8 },
	                boostOptional: true,
	                boost: { UO: 8 },
	                rules: { mine: { subtype: 'mineral' }, drop: { priority: 5 } }
	            }
	        },
	        quota: 'mine-energy',
	        rules: {
	            mine: { subtype: 'energy' },
	            drop: { priority: 5 }
	        },
	        actions: { avoid: {}, minecart: {} }
	    },
	    hauler: {
	        versions: {
	            spawn: {
	                quota: 'spawnhauler',
	                critical: true,
	                parts: {carry: 32, move: 16},
	                rules: {
	                    pickup: { subtype: false, local: true },
	                    deliver: { subtype: 'spawn', local: true },
	                    idle: { type: 'spawn' }
	                },
	                actions: { assignRoom: { type: 'spawn' } }
	            },
	            transfer: {
	                quota: 'transfer',
	                allocation: 2,
	                max: 8,
	                rules: { transfer: {}, deliver: { minerals: true, mineralTypes: [ STRUCTURE_STORAGE ], priority: 99 } },
	                parts: {carry: 10, move: 10}
	            },
	            stockpile: {
	                quota: 'stockpilehauler',
	                rules: {
	                    pickup: { subtype: false, types: [ STRUCTURE_STORAGE ] },
	                    deliver: { local: true, subtype: 'stockpile' }
	                },
	                actions: { avoid: {}, assignRoom: { type: 'stockpile' } },
	                parts: { carry: 30, move: 15 }
	            },
	            leveler: {
	                quota: 'levelerhauler',
	                max: 8,
	                rules: {
	                    pickup: { distanceWeight: 150, subtype: 'level' },
	                    deliver: { types: [ STRUCTURE_STORAGE ], ignoreCreeps: true, ignoreDistance: true }
	                },
	                parts: { carry: 30, move: 15 }
	            },
	            long: {
	                quota: 'longhauler',
	                rules: {
	                    pickup: { local: true, types: [ STRUCTURE_CONTAINER ], subtype: 'remote' },
	                    deliver: { types: [ STRUCTURE_STORAGE ], ignoreCreeps: true, profile: true }
	                },
	                parts: { carry: 32, move: 16 },
	                actions: { avoid: {}, assignRoom: { type: 'pickup' } }
	            },
	            mineral: {
	                quota: 'pickup-mineral',
	                allocation: 1500,
	                max: 4,
	                parts: { carry: 20, move: 10 },
	                rules: {
	                    pickup: { subtype: 'mineral', minerals: true, types: [ STRUCTURE_CONTAINER ] },
	                    deliver: { subtype: false }
	                }
	            }
	        },
	        actions: { avoid: {} }
	    },
	    observer: {
	        versions: {
	            soaker: {
	                quota: 'observe-soak',
	                max: 1,
	                boost: { XLHO2: 10, XGHO2: 10 },
	                parts: { tough: 10, move: 10, heal: 10 },
	                memory: { ignoreHealth: true },
	                rules: { observe: { subtype: 'soak' } },
	                actions: { boost: {}, selfheal: {} }
	            },
	            pico: {
	                quota: 'observe',
	                parts: {tough: 1, move: 1},
	                memory: { ignoreHealth: true },
	                rules: { observe: { subtype: false } }
	            }
	        }
	    },
	    worker: {
	        versions: {
	            builder: {
	                quota: 'build',
	                allocation: 3,
	                max: 4,
	                boostOptional: true,
	                boost: { XLH2O: 5 },
	                rules: {
	                    pickup: {},
	                    build: {},
	                    repair: { priority: 99 }
	                },
	                parts: { work: 5, carry: 10, move: 15 }
	            },
	            upgrade: {
	                quota: 'upgrade',
	                allocation: 15,
	                parts: { work: 15, carry: 3, move: 9 },
	                rules: { pickup: {}, upgrade: {} }
	            },
	            repair: {
	                quota: 'repair',
	                max: 14,
	                rules: { pickup: {}, repair: {} },
	                actions: { avoid: {}, repair: {} },
	                parts: { work: 5, carry: 10, move: 8 }
	            },
	            dismantle: {
	                quota: 'dismantle',
	                max: 2,
	                allocation: 2000000,
	                boostOptional: true,
	                boost: { XZH2O: 10 },
	                rules: { dismantle: {} },
	                actions: { boost: {} },
	                parts: { work: 10, move: 10 }
	            }
	        },
	        actions: { avoid: {}, energy: {} }
	    },
	    claimer: {
	        versions: {
	            attack: {
	                parts: { claim: 10, move: 10 },
	                quota: 'reserve-downgrade',
	                allocation: 10,
	                max: 4,
	                rules: { reserve: { downgrade: true } }
	            },
	            pico: {
	                parts: { claim: 2, move: 2 },
	                quota: 'reserve-reserve',
	                allocation: 2,
	                rules: { reserve: { subtype: 'reserve' } }
	            }
	        },
	    },
	    healer: {
	        versions: {
	            pico: {
	                quota: 'heal',
	                max: 1,
	                parts: { tough: 4, move: 8, heal: 4 }
	            }
	        },
	        rules: { heal: {}, idle: { type: 'heal' } }
	    },
	    fighter: {
	        versions: {
	            melee: {
	                critical: true,
	                quota: 'keep',
	                memory: { ignoreHealth: true },
	                parts: { tough: 14, move: 17, attack: 15, heal: 4 },
	                actions: { selfheal: {}, assignRoom: { type: 'keep' } }
	            },
	            ranged: {
	                quota: 'idle-defend',
	                max: 4,
	                parts: { tough: 10, move: 10, ranged_attack: 10 },
	                rules: { defend: { ranged: true }, idle: { type: 'defend' } }
	            },
	            assault: {
	                critical: true,
	                quota: 'idle-assault',
	                allocation: 1,
	                max: 4,
	                boost: { XLHO2: 10, XGHO2: 5 },//XUH2O: 10, 
	                parts: { tough: 5, move: 25, attack: 10, heal: 10 },
	                actions: { boost: {}, selfheal: { block: true } },
	                rules: { attack: { subtype: 'assault' }, idle: { type: 'assault' } }
	            },
	            attack: {
	                quota: 'idle-attack',
	                max: 2,
	                allocation: 1,
	                parts: { tough: 17, move: 16, attack: 15 },
	                rules: { attack: { subtype: 'attack' }, idle: { type: 'attack' } }
	            },
	            raider: {
	                quota: 'idle-raid',
	                allocation: 1,
	                boost: { XUH2O: 15 }, 
	                parts: { move: 15, attack: 15 },
	                rules: { attack: { subtype: 'raid' }, idle: { type: 'raid' } }
	            },
	            picket: {
	                quota: 'idle-picket',
	                allocation: 1,
	                parts: { move: 5, attack: 5 },
	                rules: { attack: { subtype: 'picket' }, idle: { type: 'picket' } }
	            }
	        },
	        rules: { defend: {}, keep: { local: true } }
	    }
	};

/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var Actions = __webpack_require__(6);
	var Work = __webpack_require__(15);

	class WorkManager {
	    static process(catalog){
	        var workers = Work(catalog);
	        var actions = Actions(catalog);
	        var creeps = _.filter(Game.creeps, creep => !creep.spawning);

	        _.forEach(creeps, creep => WorkManager.validateCreep(creep, workers, catalog));
	        catalog.jobs.postValidate();
	        
	        var blocks = _.map(creeps, creep => WorkManager.creepAction(creep, actions, catalog));
	        
	        var startBid = Game.cpu.getUsed();
	        if(Game.cpu.bucket > 500){
	            _.forEach(creeps, creep => WorkManager.bidCreep(creep, workers, catalog, startBid));
	        }
	        if(Game.cpu.bucket > 250){
	            _.forEach(creeps, (creep, ix) => WorkManager.processCreep(creep, workers, catalog, actions, blocks[ix]));
	        }
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
	            if(result){
	                return result;
	            }
	            var blocking = actions[type].shouldBlock(creep, opts);
	            if(blocking){
	                return { type, data: blocking };
	            }
	            return result;
	        }, false);
	        creep.memory.block = !!block;
	        return block;
	    }

	    static bidCreep(creep, workers, catalog, startTime){
	        if(!creep.memory.jobType && !creep.memory.block){
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
	        }
	        var actionCPU = Game.cpu.getUsed();
	        if(block){
	            actions[block.type].blocked(creep, creep.memory.actions[block.type], block.data);
	        }else{
	            _.forEach(creep.memory.actions, (opts, type) => actions[type].postWork(creep, opts, action));
	        }
	    }
	}

	module.exports = WorkManager;

/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var AssignRoomAction = __webpack_require__(7);
	var Avoid = __webpack_require__(9);
	var Boost = __webpack_require__(10);
	var Energy = __webpack_require__(11);
	var MinecartAction = __webpack_require__(12);
	var Repair = __webpack_require__(13);
	var SelfHeal = __webpack_require__(14);

	module.exports = function(catalog){
	    return {
	        assignRoom: new AssignRoomAction(catalog),
	        avoid: new Avoid(catalog),
	        boost: new Boost(catalog),
	        energy: new Energy(catalog),
	        minecart: new MinecartAction(catalog),
	        repair: new Repair(catalog),
	        selfheal: new SelfHeal(catalog)
	    };
	};

/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(8);

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
/* 8 */
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

	    postWork(creep, opts, action){}

	    blocked(creep, opts, block){}

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
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(8);

	class AvoidAction extends BaseAction {
	    constructor(catalog){
	        super(catalog, 'avoid');
	        this.range = 6;
	    }

	    shouldBlock(creep, opts){
	        var avoid = this.catalog.getAvoid(creep.pos);
	        if(avoid && avoid.length > 0){
	            var target = this.getJobTarget(creep);
	            var positions = _.filter(avoid, pos => creep.pos.getRangeTo(pos) <= this.range);
	            if(positions.length > 0){
	                return _.map(positions, position => {
	                    if(target && target.pos.getRangeTo(position) < this.range && creep.pos.getRangeTo(position) == this.range - 1){
	                        creep.memory.blockedUntil = Game.time + 5;
	                    }
	                    return { pos: position, range: this.range + 4 };
	                });
	            }else if(creep.memory.blockedUntil > Game.time){
	                return true;
	            }
	        }else if(creep.memory.blockedUntil){
	            delete creep.memory.blockedUntil;
	        }
	        return false;
	    }

	    blocked(creep, opts, block){
	        if(block === true && creep.memory.blockedUntil > Game.time){
	            return;
	        }
	        if(block){
	            var start = Game.cpu.getUsed();
	            creep.memory.avoidUntil = Game.time + 10;
	            delete creep.memory._move;
	            var result = PathFinder.search(creep.pos, block, { flee: true });
	            creep.move(creep.pos.getDirectionTo(result.path[0]));
	            this.catalog.profileAdd('avoid', Game.cpu.getUsed() - start);
	        }
	    }
	}


	module.exports = AvoidAction;

/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(8);
	var Util = __webpack_require__(2);

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
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(8);
	var Util = __webpack_require__(2);

	var offsets = {
	    container: -1,
	    storage: -1.25,
	    link: -1.5,
	};

	class EnergyAction extends BaseAction {
	    constructor(catalog){
	        super(catalog, 'energy');
	    }

	    postWork(creep, opts, action){
	        var storage = Util.getStorage(creep);
	        if(storage < creep.carryCapacity * 0.25){
	            // var energy = this.catalog.lookForArea(creep.room, creep.pos, LOOK_ENERGY, 2);
	            var containers = this.catalog.lookForArea(creep.room, creep.pos, LOOK_STRUCTURES, 2);
	            var targets = _.filter(containers, struct => (struct.structureType == STRUCTURE_CONTAINER || struct.structureType == STRUCTURE_STORAGE || struct.structureType == STRUCTURE_LINK) && Util.getResource(struct, RESOURCE_ENERGY) > 0);
	            var nearby = _.first(_.sortBy(targets, target => offsets[target.structureType] * Math.min(creep.carryCapacity, Util.getResource(target, RESOURCE_ENERGY))));
	            if(nearby){
	                creep.withdraw(nearby, RESOURCE_ENERGY, Math.min(Util.getCapacity(creep) - storage, Util.getResource(nearby, RESOURCE_ENERGY)));
	            }
	        }
	    }
	}


	module.exports = EnergyAction;

/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(8);

	var offsets = {
	    container: 0.5,
	    storage: 0.25,
	    link: 0,
	    tower: -1
	};

	class MinecartAction extends BaseAction {
	    constructor(catalog){
	        super(catalog, 'minecart');
	    }

	    postWork(creep, opts, action){
	        if(_.sum(creep.carry) >= creep.carryCapacity * 0.7){
	            var containers = this.catalog.lookForArea(creep.room, creep.pos, LOOK_STRUCTURES, 2);
	            var targets = _.filter(containers, struct => (struct.structureType == STRUCTURE_CONTAINER || struct.structureType == STRUCTURE_STORAGE || struct.structureType == STRUCTURE_LINK || struct.structureType == STRUCTURE_TOWER) && this.catalog.notFull(struct));
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
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(8);
	var Util = __webpack_require__(2);

	class RepairAction extends BaseAction {
	    constructor(catalog){
	        super(catalog, 'repair');
	    }

	    postWork(creep, opts, action){
	        if(!action && creep.carry.energy > creep.carryCapacity / 8){
	            var structures = creep.room.lookForAtArea(LOOK_STRUCTURES, Math.max(0, creep.pos.y - 3), Math.max(0, creep.pos.x - 3), Math.min(49, creep.pos.y + 3), Math.min(49, creep.pos.x + 3), true);
	            var targets = _.filter(structures, struct => struct.structure.hits < Math.min(struct.structure.hitsMax, Memory.settings.repairTarget) && Util.owned(struct));
	            if(targets.length > 0){
	                creep.repair(targets[0].structure);
	            }
	        }
	    }
	}


	module.exports = RepairAction;

/***/ },
/* 14 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseAction = __webpack_require__(8);

	class SelfHealAction extends BaseAction {
	    constructor(catalog){
	        super(catalog, 'selfheal');
	    }

	    shouldBlock(creep, opts){
	        return opts.block && creep.hits < creep.hitsMax - 200;
	    }

	    postWork(creep, opts, action){
	        if(!action && creep.hits < creep.hitsMax){
	            creep.heal(creep);
	        }
	    }

	    blocked(creep, opts, block){
	        if(creep.hits < creep.hitsMax){
	            creep.heal(creep);
	        }
	    }

	}


	module.exports = SelfHealAction;

/***/ },
/* 15 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var Attack = __webpack_require__(16);
	var Build = __webpack_require__(19);
	var Defend = __webpack_require__(20);
	var Deliver = __webpack_require__(21);
	var Dismantle = __webpack_require__(22);
	var Drop = __webpack_require__(23);
	var Heal = __webpack_require__(24);
	var Idle = __webpack_require__(25);
	var Keep = __webpack_require__(26);
	var Mine = __webpack_require__(27);
	var Observe = __webpack_require__(28);
	var Pickup = __webpack_require__(29);
	var Repair = __webpack_require__(30);
	var Reserve = __webpack_require__(32);
	var Transfer = __webpack_require__(33);
	var Upgrade = __webpack_require__(34);

	module.exports = function(catalog){
	    return {
	        attack: new Attack(catalog),
	        build: new Build(catalog),
	        defend: new Defend(catalog),
	        deliver: new Deliver(catalog),
	        dismantle: new Dismantle(catalog),
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
/* 16 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(17);

	class AttackWorker extends BaseWorker {
	    // ignoreDestructibleStructures: true,
	    constructor(catalog){ super(catalog, 'attack', { chatty: true, moveOpts: { reusePath: 4 } }); }

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
/* 17 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var SimpleWorker = __webpack_require__(18);

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
	            if(opts.local && creep.memory.room && creep.memory.room != _.get(job, 'target.pos.roomName')){
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
/* 18 */
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

	    calculateBoostedTotal(creep, part, boost, effect){
	        var partCount = creep.getActiveBodyparts(part);
	        var boosted = _.get(creep.memory.boosted, boost, 0);
	        return partCount - boosted + boosted * _.get(BOOSTS, [part, boost, effect], 0);
	    }

	    move(creep, target){
	        var start = Game.cpu.getUsed();
	        if(this.moveOpts){
	            var result = creep.moveTo(target, this.moveOpts);
	            this.catalog.profileAdd('move', Game.cpu.getUsed() - start);
	            this.catalog.profileAdd('movedCreeps', 1);
	            return result;
	        }
	        if(creep.memory.avoidUntil > Game.time && Game.cpu.bucket > 5000){
	            var range = 6;
	            var result = creep.moveTo(target, { reusePath: 25, costCallback: (roomName, costMatrix) => {
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
	                            if(ix == minX || ix == maxX || iy == minY || iy == maxY){
	                                costMatrix.set(ix, iy, 10);
	                            }else{
	                                costMatrix.set(ix, iy, 256);
	                            }
	                        }
	                    }
	                }
	            }});
	            this.catalog.profileAdd('avoid', Game.cpu.getUsed() - start);
	            return result;
	        }

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
	            var result = creep.moveTo(target, { reusePath: 50 });
	        }else{
	            var result = creep.travelTo(target, { allowSK: true });
	        }
	        
	        this.catalog.profileAdd('move', Game.cpu.getUsed() - start);
	        this.catalog.profileAdd('movedCreeps', 1);
	        return result;
	    }

	    orMove(creep, target, result){
	        if(result == ERR_NOT_IN_RANGE){
	            if(this.move(creep, target) == OK){
	                this.catalog.profileAdd('actions', 0.2);
	            }
	        }
	        if(result == OK){
	            this.catalog.profileAdd('actions', 0.2);
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
	    
	    stop(creep, opts){
	        if(this.debug){
	            console.log('stop', this.type)
	        }
	        if(this.idleTimer > 0){
	            delete creep.memory.idleCheck;
	        }
	    }

	}

	module.exports = SimpleWorker;

/***/ },
/* 19 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(17);

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
/* 20 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(17);

	class DefendWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'defend', { flagPrefix: 'Defend', chatty: true, moveOpts: { reusePath: 15 } }); }

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
/* 21 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(17);

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
	            if(opts.types && !_.includes(opts.types, job.target.structureType)){
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
	    }

	}

	module.exports = DeliverWorker;

/***/ },
/* 22 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(17);

	class DismantleWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'dismantle'); }

	    calculateAllocation(creep, opts){
	        return creep.getActiveBodyparts(WORK) * 50 * creep.ticksToLive;
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        return distance / this.distanceWeight;
	    }

	    processStep(creep, job, target, opts){
	        this.orMove(creep, target, creep.dismantle(target));
	    }

	}

	module.exports = DismantleWorker;

/***/ },
/* 23 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var SimpleWorker = __webpack_require__(18);

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
/* 24 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(17);

	class HealWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'heal', { chatty: true, simpleMove: true }); }

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
	        }else{
	            this.orMove(creep, target, creep.heal(target));
	        }
	    }

	}

	module.exports = HealWorker;

/***/ },
/* 25 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(17);

	class IdleWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'idle', { idleTimer: 10 }); }

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
/* 26 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(17);

	class KeepWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'keep'); }

	    isValid(creep, opts, job, target){
	        return job.capacity >= job.allocated && _.get(Memory.stats.rooms, [target.pos.roomName, 'hostileCount'], 0) == 0;
	    }

	    calculateAllocation(creep, opts){
	        if(creep.memory.boosted && creep.memory.boosted.XUH2O > 0){
	            return this.calculateBoostedTotal(creep, 'attack', 'XUH2O', 'attack')  + creep.getActiveBodyparts(RANGED_ATTACK);
	        }
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
	            //TODO use pathfinder flee
	            creep.move((creep.pos.getDirectionTo(target)+4)%8);
	        }
	    }

	}

	module.exports = KeepWorker;

/***/ },
/* 27 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(17);

	class MineWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'mine'); }

	    isValid(creep, opts, job, target){
	        return this.catalog.getAvailableCapacity(creep) > 0;
	    }

	    canBid(creep, opts){
	        return !this.catalog.isFull(creep);
	    }

	    calculateAllocation(creep, opts){
	        // if(creep.memory.boosted && creep.memory.boosted.XUHO2 > 0){
	        //     return 8 * creep.getActiveBodyparts(WORK);
	        // }
	        // return creep.getActiveBodyparts(WORK);
	        return 8;
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        return this.catalog.getResourcePercent(creep, RESOURCE_ENERGY) + distance / this.distanceWeight;
	    }

	    processStep(creep, job, target, opts){
	        this.orMove(creep, target, creep.harvest(target));
	    }

	}

	module.exports = MineWorker;

/***/ },
/* 28 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(17);

	class ObserveWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'observe'); }

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
/* 29 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(17);

	var offset = {
	    link: 0,
	    container: 0.05
	}

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
	        if(!opts.minerals && job.resource != RESOURCE_ENERGY){
	            return false;
	        }
	        if(opts.types && !job.dropped && !_.includes(opts.types, job.target.structureType)){
	            return false;
	        }
	        var offset = _.get(offset, job.target.structureType, 0);
	        if(job.resource != RESOURCE_ENERGY && job.dropped){
	            offset = -1;
	        }
	        return 1 + this.getStorageOffset(creep) + distance / distanceWeight + this.calcAvailRatio(job, allocation) + offset;
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
	            this.catalog.profileAdd('actions', 0.2);
	        }
	    }

	}

	module.exports = PickupWorker;

/***/ },
/* 30 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var StaticWorker = __webpack_require__(31);

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
/* 31 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var SimpleWorker = __webpack_require__(18);

	class StaticWorker extends SimpleWorker {
	    constructor(catalog, type, opts){
	        super(catalog, type, opts);
	        this.capacity = this.capacity || 1;
	        this.allocation = this.allocation || 1;
	        this.getTargetData = this.getTargetData.bind(this);
	    }

	    stillValid(creep, opts){
	        var job = this.getTargetData(creep.memory.jobId);
	        return job.target && super.stillValid(creep, opts) && this.isValid(creep, opts, job.target, job);
	    }

	    isValid(creep, opts, target, job){
	        return true;
	    }

	    getTargets(){
	        var jobs = Memory.jobs[this.type];
	        if(jobs && jobs.length > 0){
	            return jobs;
	        }
	        return [];
	    }

	    getTargetData(jobId){
	        if(this.multipart){
	            var result =  _.zipObject(this.multipart, jobId.split('-'));
	            result.targetId = result.id;
	            result.target = Game.getObjectById(result.targetId);
	            result.id = jobId;
	            return result;
	        }
	        return {
	            id: jobId,
	            target: Game.getObjectById(jobId),
	            targetId: jobId
	        };
	    }

	    jobExists(jobId){
	        return _.includes(this.getTargets(), jobId);
	    }

	    bid(creep, opts){
	        if(!this.shouldBid(creep, opts)){
	            return false;
	        }
	        var targetId = _.find(this.getTargets(), jobId => {
	            var job = this.getTargetData(jobId);
	            var allocated = _.get(this.catalog.jobs.staticAllocation, [this.type, jobId], 0);
	            return job.target && allocated < this.capacity && this.canBid(creep, opts, job.target, job);
	        });
	        if(!targetId){
	            return false;
	        }
	        var job = this.getTargetData(targetId);
	        // console.log(creep, 'bid for', job.target, _.get(this.catalog.jobs.staticAllocation, [this.type, targetId], 0), targetId);
	        if(job.target){
	            return {
	                job,
	                type: this.type,
	                allocation: this.allocation,
	                bid: this.calculateBid(creep, opts, job.target, job) + _.get(opts, 'priority', 0)
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

	    calculateBid(creep, opts, target, job){
	        var distance = this.catalog.getRealDistance(creep, target) / this.distanceWeight;
	        if(this.requiresEnergy){
	            return (1 - creep.carry.energy / creep.carryCapacity) / 5 + distance;
	        }else{
	            return distance;
	        }
	    }

	    process(creep, opts){
	        var job = this.getTargetData(creep.memory.jobId);
	        if(!job.target){
	            return false;
	        }
	        return this.processStep(creep, job.target, opts, job);
	    }

	    processStep(creep, target, opts, job){
	        return false;
	    }

	}

	module.exports = StaticWorker;

/***/ },
/* 32 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(17);

	class ReserveWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'reserve'); }

	    calculateAllocation(creep, opts){
	        return creep.getActiveBodyparts(CLAIM);
	    }

	    calculateBid(creep, opts, job, allocation, distance){
	        if(!opts.downgrade && job.downgrade){
	            return false;
	        }
	        if(opts.downgrade && job.downgrade){
	            return -10 + distance/this.distanceWeight;
	        }
	        if(job.subtype == 'reserve'){
	            return _.get(job.target, 'reservation.ticksToEnd', 0) / 5000;
	        }
	        return distance/this.distanceWeight;
	    }

	    processStep(creep, job, target, opts){
	        if(target.name){
	            this.move(creep, target);
	        }else if(job.downgrade && opts.downgrade){
	            this.orMove(creep, target, creep.attackController(target));
	        }else if(job.claim){
	            if(this.orMove(creep, target, creep.claimController(target)) == OK){
	                job.flag.remove();
	            }
	        }else{
	            this.orMove(creep, target, creep.reserveController(target));
	        }
	    }

	}

	module.exports = ReserveWorker;

/***/ },
/* 33 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var StaticWorker = __webpack_require__(31);
	var Util = __webpack_require__(2);

	class TransferWorker extends StaticWorker {
	    constructor(catalog){ super(catalog, 'transfer', { chatty: true, multipart: ['subtype', 'resource', 'amount', 'id'] }); }

	    validate(creep, opts, target, job){
	        var resources = Util.getResource(creep, job.resource);
	        var targetResources = Util.getResource(job.target, job.resource);
	        var data = this.catalog.resources[job.resource];
	        var allStored = data.stored;
	        var stored = data.totals.storage;
	        var terminalStored = data.totals.terminal;
	        if(job.subtype == 'store'){
	            if(resources > 0){
	                return true;
	            }else{
	                return targetResources > job.amount;
	            }
	        }else if(job.subtype == 'deliver'){
	            if(resources > 0){
	                return targetResources < job.amount;
	            }else{
	                return targetResources < job.amount && allStored > 0;
	            }
	        }else if(job.subtype == 'terminal'){
	            if(resources > 0){
	                return terminalStored < job.amount;
	            }else{
	                return terminalStored < job.amount && stored > 0;
	            }
	        }
	        console.log('invalid type', job.id, creep, job.subtype);
	        return false;
	    }

	    isValid(creep, opts, target, job){
	        var valid = this.validate(creep, opts, target, job);
	        if(valid && Util.getResource(creep, job.resource) == 0 && !this.jobExists(job.id)){
	            return false;
	        }
	        return valid;
	    }

	    canBid(creep, opts, target, job){
	        if(creep.ticksToLive < 100){
	            return false;
	        }
	        var resources = Util.getResource(creep, job.resource);
	        if(Util.getStorage(creep) > 0 && resources == 0){
	            return false;
	        }
	        return this.validate(creep, opts, target, job);
	    }

	    processStep(creep, target, opts, job){
	        var deliver = false;
	        var pickup = false;
	        var resources = Util.getResource(creep, job.resource);
	        if(resources > 0){
	            creep.memory.transferPickup = false;
	            deliver = this.getDeliver(creep, job, resources);
	        }else{
	            creep.memory.transferDeliver = false;
	            pickup = this.getPickup(creep, job);
	        }
	        if(deliver){
	            this.orMove(creep, deliver.target, creep.transfer(deliver.target, job.resource, deliver.amount));
	        }else if(pickup){
	            this.orMove(creep, pickup.target, creep.withdraw(pickup.target, job.resource, Math.min(Util.getCapacity(creep) - Util.getStorage(creep), pickup.amount)));
	        }
	    }

	    getTargetNeed(job){
	        var targetResources = Util.getResource(job.target, job.resource);
	        return Math.max(0, job.amount - targetResources);
	    }

	    getDeliverAmount(job, resources){
	        if(job.subtype == 'store'){
	            return resources;
	        }
	        return Math.min(resources, this.getTargetNeed(job));
	    }

	    getDeliver(creep, job, resources){
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
	        if(job.subtype == 'store'){
	            var terminalIdeal = Memory.settings.terminalIdealResources * _.size(this.catalog.buildings.terminal);
	            if(this.catalog.resources[job.resource].totals.terminal + resources <= terminalIdeal + 10000){
	                target = _.first(Util.helper.closestNotFull(creep, this.catalog.buildings.terminal));
	            }else{
	                target = _.first(Util.helper.closestNotFull(creep, this.catalog.buildings.storage));
	            }
	        }else if(job.subtype == 'terminal'){
	            target = _.first(Util.helper.closestNotFull(creep, this.catalog.buildings.terminal));
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

	    getPickup(creep, job){
	        if(creep.memory.transferPickup){
	            var target = Game.getObjectById(creep.memory.transferPickup);
	            var targetResources = Util.getResource(target, job.resource);
	            if(target && targetResources > 0){
	                return {
	                    target,
	                    amount: Math.min(targetResources, this.getTargetNeed(job))
	                };
	            }
	        }
	        var data = this.catalog.resources[job.resource];
	        var target;
	        if(job.subtype == 'store'){
	            target = job.target;
	        }else if(job.subtype == 'terminal'){
	            target = _.first(Util.sort.closest(creep, data.storage));
	        }else if(job.subtype == 'deliver'){
	            target = _.first(Util.sort.closest(creep, data.sources));
	        }
	        var targetResources = Util.getResource(target, job.resource);
	        if(target && targetResources > 0){
	            creep.memory.transferPickup = target.id;
	            return {
	                target,
	                amount: Math.min(targetResources, this.getTargetNeed(job))
	            };
	        }
	        //DEBUG
	        console.log('could not generate pickup target', creep, job.id, resources);
	        return false;
	    }

	    start(creep, bid, opts){
	        super.start(creep, bid, opts);
	        creep.memory.transferPickup = false;
	        creep.memory.transferDeliver = false;
	    }

	    stop(creep, opts){
	        super.stop(creep, opts);
	        if(creep.memory.transferPickup){
	            delete creep.memory.transferPickup;
	        }
	        if(creep.memory.transferDeliver){
	            delete creep.memory.transferDeliver;
	        }
	    }

	}

	module.exports = TransferWorker;

/***/ },
/* 34 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseWorker = __webpack_require__(17);

	class UpgradeWorker extends BaseWorker {
	    constructor(catalog){ super(catalog, 'upgrade', { requiresEnergy: true, chatty: true }); }

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
/* 35 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var JobManager = __webpack_require__(36);
	var QuotaManager = __webpack_require__(55);
	var Util = __webpack_require__(2);

	class Catalog {
	    constructor(){
	        _.assign(this, Util);

	        this.structures = {};
	        this.hostile = {
	            structures: {},
	            creeps: {}
	        };

	        this.droppedResources = {};
	        this.storedResources = {};
	        this.labResources = {};

	        this.flagsPrefix = {};

	        this.creeps = {
	            class: _.groupBy(Game.creeps, creep => creep.memory.class),
	            type: _.groupBy(Game.creeps, creep => creep.memory.type),
	            room: _.groupBy(Game.creeps, creep => creep.pos.roomName)
	        };

	        this.buildings = _.groupBy(Game.structures, structure => structure.structureType);

	        this.rooms = _.filter(Game.rooms, 'controller.my');
	        this.avoid = {};

	        this.jobs = new JobManager(this);

	        this.quota = new QuotaManager(this);

	        this.profileData = {};

	        this.storage = {};
	        this.resources = _.zipObject(RESOURCES_ALL, _.map(RESOURCES_ALL, resource => {
	            return { total: 0, stored: 0, sources: [], storage: [], terminal: [], lab: [], totals: { storage: 0,  terminal: 0, lab: 0 } }
	        }));
	        _.forEach(this.buildings.storage, (storage)=>this.processStorage(storage));
	        _.forEach(this.buildings.terminal, (storage)=>this.processStorage(storage));
	        _.forEach(this.buildings.lab, (storage)=>this.processStorage(storage));
	        // _.forEach(this.resources, (resource, type) => console.log(type, resource.total, resource.stored, resource.totals.lab));
	    }

	    processStorage(storage){
	        var isLab = storage.structureType == STRUCTURE_LAB;
	        var resources = this.getResourceList(storage);
	        this.storage[storage.id] = resources;
	        _.forEach(resources, (amount, type)=>{
	            this.resources[type].total += amount;
	            if(!isLab){
	                this.resources[type].stored += amount;
	            }
	            this.resources[type].totals[storage.structureType] += amount;
	            this.resources[type][storage.structureType].push(storage);
	            if(!isLab && (type != RESOURCE_ENERGY || storage.structureType == STRUCTURE_STORAGE)){
	                this.resources[type].sources.push(storage);
	            }
	        });
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
	        //DEPRECATED?? its not used anywhere
	        if(!room.name){ return []; }
	        if(!resourceType){
	            resourceType = RESOURCE_ENERGY;
	        }
	        var containers = _.filter(this.getStructuresByType(room, containerTypes || [ STRUCTURE_STORAGE, STRUCTURE_CONTAINER ]), structure => this.getResource(structure, resourceType) > 0);
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
	        var access = _.get(Memory.cache.accessibility, name, false);
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
	                Memory.cache.accessibility[name] = access;
	            }
	        }
	        return access;
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

	    isResourceInRange(entity, type, min, max){
	        if(!entity){
	            return false;
	        }
	        var amount = this.catalog.getResource(entity, type);
	        return amount > min && amount < max;
	    }

	    isCreep(entity){
	        return entity.carryCapacity > 0;
	    }

	    hasMinerals(entity){
	        return this.getStorage(entity) > this.getResource(entity, RESOURCE_ENERGY);
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

	    requestWatch(roomName){
	        if(!Memory.watch[roomName]){
	            console.log('Starting to watch', roomName);
	        }
	        Memory.watch[roomName] = Game.time + 100;
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
/* 36 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var Jobs = __webpack_require__(37);

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
	        this.dirty = [];
	    }

	    generate(){
	        _.forEach(this.categories, (category, categoryName) =>{
	            // var start = Game.cpu.getUsed();
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
	            // var cpu = Game.cpu.getUsed() - start;
	            // if(cpu > 2){
	            //     console.log(categoryName, cpu, JSON.stringify(_.countBy(jobList, 'subtype')));
	            // }
	        });
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
	            var dirty = this.categories[type].removeAllocation(this.jobs[type], jobId, allocation);
	            this.allocation[type] -= allocation;
	            if(dirty){
	                this.dirty.push(type);
	            }
	        }
	    }

	    postValidate(){
	        _.forEach(this.dirty, (type) =>{
	            this.openJobs[type] = _.pick(this.jobs[type], job => job.allocated < job.capacity);
	        });
	    }
	}

	module.exports = JobManager;

/***/ },
/* 37 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var Attack = __webpack_require__(38);
	var Build = __webpack_require__(40);
	var Defend = __webpack_require__(41);
	var Deliver = __webpack_require__(42);
	var Dismantle = __webpack_require__(43);
	var Mine = __webpack_require__(44);
	var Idle = __webpack_require__(45);
	var Keep = __webpack_require__(46);
	var Observe = __webpack_require__(47);
	var Pickup = __webpack_require__(48);
	var Repair = __webpack_require__(49);
	var Reserve = __webpack_require__(51);
	var Transfer = __webpack_require__(52);
	var Upgrade = __webpack_require__(53);
	var Heal = __webpack_require__(54);

	module.exports = function(catalog){
	    return {
	        attack: new Attack(catalog),
	        build: new Build(catalog),
	        defend: new Defend(catalog),
	        deliver: new Deliver(catalog),
	        dismantle: new Dismantle(catalog),
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
/* 38 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(39);

	class AttackJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'attack', { flagPrefix: 'Attack' }); }

	    calculateCapacity(room, target, flag){
	        return 60;
	    }

	    generateTargets(room){
	        return this.catalog.getHostileCreeps(room);
	    }

	    generateJobsForFlag(flag){
	        var subtype = this.getSubflag(flag);
	        if(flag.room){
	            if(flag.name.includes('target')){
	                var results = flag.pos.lookFor(LOOK_STRUCTURES);
	                if(results && results.length > 0){
	                    // console.log(results);
	                    return _.map(results, target => this.generateJobForTarget(flag.room, target, flag, subtype));
	                }
	            }
	            var hostileStructures = flag.room.find(FIND_HOSTILE_STRUCTURES);
	            var towers = _.filter(hostileStructures, structure => structure.structureType == STRUCTURE_TOWER);
	            if(towers.length > 0){
	                return _.map(towers, target => this.generateJobForTarget(flag.room, target, flag, subtype));
	            }
	            var spawns = _.filter(hostileStructures, structure => structure.structureType == STRUCTURE_SPAWN);
	            if(spawns.length > 0){
	                return _.map(spawns, target => this.generateJobForTarget(flag.room, target, flag, subtype));
	            }
	            var structures = _.filter(hostileStructures, structure => structure.structureType != STRUCTURE_CONTROLLER && structure.structureType != STRUCTURE_RAMPART);
	            var targets = _.filter(this.catalog.getHostileCreeps(flag.room), enemy => flag.pos.getRangeTo(enemy) <= Memory.settings.flagRange.attack);
	            if(structures.length > 0){
	                targets = targets.concat(structures);
	            }
	            if(targets.length > 0){
	                return _.map(targets, target => this.generateJobForTarget(flag.room, target, flag, subtype));
	            }
	        }else{
	            return [this.generateJobForTarget(flag.room, flag, flag, subtype)];
	        }
	        return [];
	    }

	    generateJobForTarget(room, target, flag, subtype){
	        var job = super.generateJobForTarget(room, target, flag);
	        if(subtype){
	            job.subtype = subtype;
	            job.id = this.generateId(target, subtype);
	        }
	        return job;
	    }
	}

	module.exports = AttackJob;



/***/ },
/* 39 */
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

	    generateId(entity, subtype){
	        if(subtype){
	            return this.type+'-'+subtype+'-'+(entity.id || entity.name);
	        }
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
/* 40 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(39);

	var offsets = {
	    container: -0.5,
	    tower: -1,
	    extension: -0.25,
	    road: 0.5,
	    constructedWall: -1,
	    rampart: -1,
	    spawn: -1,
	    lab: 1.5,
	    terminal: 1.5
	}

	class BuildJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'build'); }

	    calculateCapacity(room, target){
	        return Math.min(12, Math.ceil((target.progressTotal - target.progress) / 1000));
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
/* 41 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(39);

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
/* 42 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(39);

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
	    STRUCTURE_TOWER
	];

	var mineralContainers = [
	    STRUCTURE_STORAGE
	];

	class DeliverJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'deliver'); }

	    generateJobs(room){
	        var energyNeeds = _.filter(this.catalog.getStructuresByType(room, types), structure => this.catalog.getAvailableCapacity(structure) > 0);
	        var result = _.map(energyNeeds, entity => {
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

	        _.forEach(Memory.stockpile, id =>{
	            var stockpile = Game.getObjectById(id);
	            if(!stockpile){
	                console.log('stockpile missing', id, stockpile);
	                return;
	            }
	            var capacity = this.catalog.getAvailableCapacity(stockpile);
	            if(capacity < 100){
	                return;
	            }
	            result.push({
	                allocated: 0,
	                capacity: 5000,
	                id: this.generateId(stockpile, 'stockpile'),
	                target: stockpile,
	                creep: false,
	                offset: 0,
	                minerals: false,
	                subtype: 'stockpile'
	            });
	        });

	        return result;
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
/* 43 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(39);
	var Util = __webpack_require__(2);

	class DismantleJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'dismantle', { flagPrefix: 'Dismantle' }); }

	    calculateCapacity(room, target){
	        return target.hits;
	    }

	    generateTargets(room, flag){
	        if(!flag || !flag.room){
	            return [];
	        }
	        var results = flag.pos.lookFor(LOOK_STRUCTURES);
	        if(results && results.length > 0){
	            return results;
	        }else{
	            console.log('No targets found:', flag.pos, flag.name);
	            flag.remove();
	        }
	    }
	}

	module.exports = DismantleJob;

/***/ },
/* 44 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(39);

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
	        if(roomStats && roomStats.extractor && roomStats.mineralAmount > 0 && !_.includes(Memory.limits.mineral, roomStats.mineralType)){
	            var mineral = Game.getObjectById(roomStats.mineralId);
	            if(mineral && mineral.mineralAmount > 0){
	                targets.push(mineral);
	            }
	        }
	        // var hostiles = this.catalog.getHostileCreeps(room);
	        // targets = _.filter(targets, target => _.size(_.filter(hostiles, hostile => target.pos.getRangeTo(hostile) <= 10)) == 0);
	        if(flag && Memory.settings.flagRange[this.type] > 0){
	            var result = _.filter(targets, target => flag.pos.getRangeTo(target) <= Memory.settings.flagRange[this.type]);
	            _.set(Memory, ['roomlist', 'pickup', flag.pos.roomName], _.size(result));
	            return result;
	        }
	        return targets;
	    }

	    generateJobForTarget(room, target, flag){
	        var job = super.generateJobForTarget(room, target, flag);
	        if(job.target.mineralAmount > 0){
	            job.subtype = 'mineral';
	        }else{
	            job.subtype = 'energy';
	        }
	        return job;
	    }
	}

	module.exports = MineJob;



/***/ },
/* 45 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(39);

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
	                idleType: type,
	                subtype: type
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
	                idleType: parts[1],
	                subtype: parts[1]
	            }];
	        }
	        if(parts.length == 2){
	            return [{
	                allocated: 0,
	                capacity: 2,
	                id: this.generateId(flag)+"-"+parts[1],
	                target: flag,
	                idleType: parts[1],
	                subtype: parts[1]
	            }];
	        }
	        return [];
	    }
	}

	module.exports = IdleJob;

/***/ },
/* 46 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(39);

	class KeepJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'keep', { flagPrefix: 'Keep' }); }

	    calculateCapacity(room, target){
	        // var access = Math.min(2, this.catalog.getAccessibility(target.pos, room));
	        // if(target.ticksToSpawn > 60 && target.ticksToSpawn < 100){
	        //     return 15;
	        // }else 
	        if(target.ticksToSpawn >= 80 && target.ticksToSpawn < 280){
	            return 0;
	        }
	        return 15;
	        // return 15 * access;
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
	            _.set(Memory, ['keeps', flag.pos.roomName], _.size(keeps));
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
/* 47 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(39);

	class ObserveJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'observe', { flagPrefix: 'Observe' }); }

	    generateJobsForFlag(flag){
	        var subflag = this.getSubflag(flag);
	        if(!flag.room){
	            this.catalog.requestWatch(flag.pos.roomName);
	        }
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
/* 48 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(39);

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
	                    id: this.generateId(entity)+'-'+type,
	                    target: entity,
	                    dropped: !!entity.resourceType,
	                    resource: type,
	                    subtype: type != RESOURCE_ENERGY ? 'mineral' : !!flag ? 'remote' : false
	                });
	            });
	        }, []);
	        return result;
	    }

	    postGenerate(jobs){
	        var storage = _.first(_.sortBy(this.catalog.buildings.storage, storage => -storage.store[RESOURCE_ENERGY]));
	        if(storage){
	            var id = this.generateId(storage, 'level');
	            var levelJob = {
	                allocated: 0,
	                capacity: storage.store[RESOURCE_ENERGY],
	                id,
	                target: storage,
	                dropped: false,
	                resource: RESOURCE_ENERGY,
	                subtype: 'level'
	            };
	            jobs[id] = levelJob;
	        }

	        return jobs;
	    }
	}

	module.exports = PickupJob;

/***/ },
/* 49 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var StaticJob = __webpack_require__(50);
	var Util = __webpack_require__(2);

	class RepairJob extends StaticJob {
	    constructor(catalog){ super(catalog, 'repair', { flagPrefix: 'Repair', refresh: 20 }); }

	    generateTargets(room){
	        return _.filter(this.catalog.getStructures(room), structure => structure.hits < Math.min(structure.hitsMax, Memory.settings.repairTarget) && Util.owned(structure));
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
/* 50 */
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
	        if(this.refresh > 0 && !this.catalog.interval(this.refresh)){
	            return {};
	        }

	        var finalTargets = this.finalizeTargetList(this.generateAllTargets());

	        Memory.jobs[this.type] = this.generateJobs(finalTargets);
	        return {};
	    }

	    generateAllTargets(){
	        var targetLists = _.map(this.catalog.rooms, room => this.generateTargets(room));
	        if(this.flagPrefix){
	            var flagTargetLists = _.map(this.catalog.getFlagsByPrefix(this.flagPrefix), flag => this.generateTargetsForFlag(flag));
	            if(flagTargetLists.length > 0){
	                targetLists = targetLists.concat(flagTargetLists);
	            }
	        }
	        return _.flatten(targetLists);
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

	    finalizeTargetList(targets){
	        return targets;
	    }

	    generateJobs(targets){
	        return _.map(targets, this.generateJob);
	    }

	    generateJob(target){
	        return target.id;
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
/* 51 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(39);

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
	        if(!subtype){
	            subtype = 'reserve';
	        }
	        var target = _.get(flag.room, 'controller', flag);
	        var access = this.catalog.getAccessibility(target.pos, target.room);
	        var job = {
	            allocated: 0,
	            capacity: 2,
	            id: this.type+"-"+flag.name,
	            target,
	            quota: 2
	        };
	        if(flag.room && subtype == 'downgrade' && !target.owner){
	            flag.remove();
	            target.pos.createFlag('Reserve-reserve-'+Game.time, COLOR_BROWN);
	            return;
	        }
	        if(subtype == 'claim'){
	            if(flag.room && flag.room.controller.my){
	                flag.remove();
	            }
	            job[subtype] = true;
	            job.subtype = 'reserve';
	            job.id = this.type+"-reserve-"+flag.name;
	            job.flag = flag;
	        }else{
	            job[subtype] = true;
	            job.subtype = subtype;
	            job.id = this.type+"-"+subtype+"-"+flag.name;
	            if(subtype == 'downgrade'){
	                job.capacity = Math.min(access * 10, 20);
	                job.quota = job.capacity;
	            }else{
	                job.quota = _.get(target, 'reservation.ticksToEnd', 0) < 4000 ? 2 : 0;
	            }
	        }
	        return [job];
	    }
	}

	module.exports = ReserveJob;

/***/ },
/* 52 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var StaticJob = __webpack_require__(50);
	var Util = __webpack_require__(2);

	class TransferJob extends StaticJob {
	    constructor(catalog){ super(catalog, 'transfer', { refresh: 10 }); }

	    generateEnergyTransfers(type, need, full){
	        return _.map(_.filter(this.catalog.buildings[type], building => this.catalog.getResource(building, RESOURCE_ENERGY) < need * (full ? 1 : 0.95)), building => {
	            return {
	                target: building,
	                resource: RESOURCE_ENERGY,
	                amount: need,
	                subtype: 'deliver'
	            };
	        });
	    }

	    generateTerminalTransfers(){
	        var targetAmount = Memory.settings.terminalIdealResources * _.size(this.catalog.buildings.terminal);
	        var totalStorage = _.size(this.catalog.buildings.storage) * 1000000;
	        return _.reduce(this.catalog.resources, (result, data, type)=>{
	            if(type != RESOURCE_ENERGY && data.totals.terminal < targetAmount && data.totals.storage > 0){
	                var storage = _.first(data.storage);
	                result.push({
	                    target: storage,
	                    resource: type,
	                    amount: targetAmount,
	                    subtype: 'terminal'
	                });
	            }
	            return result;
	        }, []);
	    }

	    generateNukeTransfers(){
	        return _.reduce(this.catalog.buildings.nuker, (result, nuker)=>{
	            if(Util.getResource(nuker, RESOURCE_GHODIUM) < 5000){
	                result.push({
	                    target: nuker,
	                    resource: RESOURCE_GHODIUM,
	                    amount: 5000,
	                    subtype: 'deliver'
	                });
	            }
	            return result;
	        }, []);
	    }

	    generateLabTransfers(){
	        var min = Memory.settings.labIdealMinerals - Memory.settings.transferRefillThreshold;
	        var max = Memory.settings.labIdealMinerals + Memory.settings.transferStoreThreshold;
	        return _.reduce(Memory.transfer.lab, (result, resource, labId) => {
	            var target = Game.structures[labId];
	            if(!target){
	                console.log('invalid lab', labId);
	                delete Memory.transfer.lab[labId];
	                return result;
	            }
	            if(resource && resource.startsWith('store')){
	                var parts = resource.split('-');
	                var wrongType = target.mineralType && target.mineralType != parts[1];
	                if(wrongType || target.mineralAmount >= Memory.settings.transferStoreThreshold){
	                    result.push({
	                        target,
	                        resource: target.mineralType,
	                        amount: 0,
	                        subtype: 'store'
	                    });
	                }
	                return result;
	            }
	            if(target.mineralType && target.mineralType != resource){
	                result.push({
	                    target,
	                    resource: target.mineralType,
	                    amount: 0,
	                    subtype: 'store'
	                });
	                return result;
	            }
	            if(!resource){
	                return result;
	            }
	            var amount = this.catalog.getResource(target, resource);
	            if(amount < min && this.catalog.resources[resource].stored > 0){
	                result.push({
	                    target,
	                    resource,
	                    amount: Memory.settings.labIdealMinerals,
	                    subtype: 'deliver'
	                });
	            }
	            if(amount > max){
	                result.push({
	                    target,
	                    resource,
	                    amount: Memory.settings.labIdealMinerals,
	                    subtype: 'store'
	                });
	            }
	            return result;
	        }, []);
	    }

	    generateAllTargets(){
	        var targetLists = [];

	        targetLists.push(this.generateEnergyTransfers('terminal', 50000));
	        targetLists.push(this.generateEnergyTransfers('lab', 2000));
	        targetLists.push(this.generateEnergyTransfers('nuker', 300000, true));
	        targetLists.push(this.generateLabTransfers());
	        targetLists.push(this.generateNukeTransfers());
	        targetLists.push(this.generateTerminalTransfers());

	        return _.flatten(targetLists);
	    }

	    generateJob(target){
	        return target.subtype + '-' + target.resource + '-' + target.amount + '-' + target.target.id;
	    }

	}

	module.exports = TransferJob;

/***/ },
/* 53 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(39);

	class UpgradeJob extends BaseJob {
	    constructor(catalog){ super(catalog, 'upgrade'); }
	    
	    calculateCapacity(room, target, flag){
	        var baseCapacity = Memory.settings.upgradeCapacity;
	        var capacity = baseCapacity;
	        var rcl = target.level;
	        if(rcl < 7){
	            capacity += baseCapacity * Math.min(2, Math.abs(rcl - 7));
	        }
	        return capacity;
	    }

	    generateTargets(){
	        return _.map(this.catalog.rooms, 'controller');
	    }
	}

	module.exports = UpgradeJob;

/***/ },
/* 54 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var BaseJob = __webpack_require__(39);

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
/* 55 */
/***/ function(module, exports) {

	"use strict";

	class QuotaManager {
	    constructor(catalog){
	        this.catalog = catalog;
	        this.quota = {};
	    }

	    process(){
	        this.quota = _.cloneDeep(this.catalog.jobs.capacity);

	        this.quota.spawnhauler = _.size(Memory.roomlist.spawn) + 1;
	        this.quota.keep = _.sum(Memory.roomlist.keep);
	        this.quota.longhauler = _.sum(Memory.roomlist.pickup);
	        this.quota.stockpilehauler = _.sum(Memory.roomlist.stockpile);

	        this.quota['reserve-reserve'] = _.sum(_.map(this.catalog.jobs.subjobs['reserve-reserve'], 'quota'));
	        // console.log(this.quota['reserve-reserve']);

	        // console.log(this.quota.transfer);

	        //spread the wealth
	        if(Memory.stats.global.totalEnergy > 100000 && Memory.stats.global.energySpread < 0.9){
	            this.quota.levelerhauler = Math.ceil((1 - Memory.stats.global.energySpread) * (Memory.stats.global.totalEnergy / 80000));
	        }else{
	            this.quota.levelerhauler = 0;
	        }
	        // console.log(_.size(this.catalog.creeps.type['assaultfighter']), this.quota['idle-assault']);

	        if(Memory.stats.global.maxSpawn < 1200){
	            this.quota.hauler = this.catalog.rooms.length * 4;
	        }
	        this.quota.repair = Math.ceil(Memory.stats.global.repair / 10000);

	        this.catalog.profile('pickup-remote', this.quota['pickup-remote']);
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
/* 56 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var memoryVersion = 1;
	var Util = __webpack_require__(2);

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

/***/ },
/* 57 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var Util = __webpack_require__(2);

	var DEFICIT_START_MIN = 750;
	var DEFICIT_END_MIN = 0;

	class Production {
	    constructor(catalog){
	        this.catalog = catalog;
	    }

	    process(){
	        if(!Util.interval(25, 2)){
	            return;
	        }
	        var targetAmount = _.size(this.catalog.buildings.terminal) * 5000;
	        var resourceList = _.values(REACTIONS.X);//_.filter(, val => val != 'XUHO2');
	        var resources = _.zipObject(resourceList, _.map(resourceList, type => targetAmount));
	        resources.G = 5000;
	        resources.UO = 5000;
	        resources.XUHO2 = 5000;

	        var reactions = {};
	        var minCapacity = _.size(Memory.production.labs) * 5;
	        _.forEach(resources, (amount, type) => {
	            this.generateReactions(type, amount - this.catalog.resources[type].total, reactions, true);
	        });

	        Memory.stats.global.reaction = _.sum(_.map(reactions, reaction => Math.max(0, reaction.deficit)));

	        _.forEach(Memory.reaction, (data, type)=>{
	            var deficit = _.get(reactions, [type, 'deficit'], 0);
	            var capacity = _.get(reactions, [type, 'capacity'], 0);
	            if(deficit <= DEFICIT_END_MIN || capacity < minCapacity){
	                console.log('Ending reaction:', type, '-', deficit, 'of', capacity);
	                delete Memory.reaction[type];
	            }else{
	                this.updateReaction(type, data, reactions[type]);
	            }
	        });

	        var freeLabs = this.countFreeLabs();
	        var runnableReactions = _.filter(reactions, (reaction, type) => reaction.capacity > DEFICIT_START_MIN && reaction.deficit > DEFICIT_START_MIN && !Memory.reaction[type]);
	        var sortedReactions = _.sortBy(runnableReactions, (reaction) => -Math.min(reaction.deficit, reaction.capacity));

	        if(freeLabs.length > 0){
	            _.forEach(sortedReactions, reaction => {
	                var type = reaction.type;
	                if(freeLabs.length > 0){
	                    console.log('Starting reaction:', type, '-', reaction.deficit, 'of', reaction.capacity);
	                    this.startReaction(type, reaction, freeLabs);
	                    freeLabs = this.countFreeLabs();
	                }
	            });
	        }
	        this.updateLabTransfers();
	    }

	    countFreeLabs(){
	        return _.difference(_.keys(Memory.production.labs), _.map(Memory.reaction, 'lab'));
	    }

	    updateLabTransfers(){
	        _.forEach(Memory.production.labs, labSet => _.forEach(labSet, (labId, ix)=>{
	            Memory.transfer.lab[labId] = false;
	        }));
	        _.forEach(Memory.reaction, (reaction, type)=>{
	            var labs = Memory.production.labs[reaction.lab];
	            _.forEach(labs, (labId, ix)=>{
	                if(ix < reaction.components.length){
	                    Memory.transfer.lab[labId] = reaction.components[ix];
	                }else{
	                    Memory.transfer.lab[labId] = 'store-'+type;
	                }
	            });
	        });
	    }

	    startReaction(type, reaction, freeLabs){
	        reaction.lab = _.first(freeLabs);
	        Memory.reaction[type] = reaction;
	    }

	    updateReaction(type, reaction, updated){
	        reaction.deficit = updated.deficit;
	        reaction.capacity = updated.capacity;
	        reaction.current = updated.current;
	    }

	    generateReactions(type, deficit, output, topLevel){
	        if(type.length == 1 && (!topLevel || type != 'G')){
	            return;
	        }
	        var components = this.findReaction(type);
	        var inventory = _.map(components, component => this.catalog.resources[component].total);
	        _.forEach(inventory, (amount, ix) =>  this.generateReactions(components[ix], deficit - amount, output, false));

	        if(output[type]){
	            output[type].deficit += deficit;
	        }else{
	            output[type] = { type, components, deficit, capacity: _.min(inventory), current: this.catalog.resources[type].total };
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

/***/ },
/* 58 */
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

/***/ }
/******/ ]);