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