"use strict";

var JobManager = require('./jobmanager');
var QuotaManager = require('./quota');
var Util = require('./util');

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
            return { total: 0, sources: [], storage: [], terminal: [], totals: { storage: 0,  terminal: 0 } }
        }));
        _.forEach(this.buildings.storage, (storage)=>this.processStorage(storage));
        _.forEach(this.buildings.terminal, (storage)=>this.processStorage(storage));
    }

    processStorage(storage){
        var resources = this.getResourceList(storage);
        this.storage[storage.id] = resources;
        _.forEach(resources, (amount, type)=>{
            this.resources[type].total += amount;
            this.resources[type].totals[storage.structureType] += amount;
            if(!(type == RESOURCE_ENERGY && storage.structureType == STRUCTURE_TERMINAL)){
                this.resources[type].sources.push(storage);
            }
            this.resources[type][storage.structureType].push(storage);
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