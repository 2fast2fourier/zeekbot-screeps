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

    StructureRampart.prototype.getMaxHits = function(){
        //TODO settings
        return Math.min(this.hitsMax, 50000);
    }

    StructureWall.prototype.getMaxHits = function(){
        //TODO settings
        return Math.min(this.hitsMax, 50000);
    }

    Structure.prototype.getDamage = function(){
        return Math.max(0, this.getMaxHits() - this.hits);
    }

};