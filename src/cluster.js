"use strict";

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
            harvest: []
        };

        this.roomflags = {
            defend: [],
            reserve: [],
            observe: [],
            claim: [],
            autobuild: []
        }

        if(!Memory.cache.path[this.id]){
            Memory.cache.path[this.id] = {};
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
        Cluster.processClusterFlags();
        _.forEach(Game.clusters, cluster => {
            if(cluster.maxRCL < 2 || _.size(cluster.structures.spawn) == 0){
                Memory.bootstrap = cluster.id;
                cluster.bootstrap = true;
            }
            if(Game.interval(30)){
                Cluster.cleanupTags(cluster);
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
    }

    static createCluster(id){
        let data = {
            assignments: {},
            labs: [],
            quota: {},
            reaction: {},
            tags: {},
            transfer: {},
            work: {}
        };
        _.set(Memory, ['clusters', id], data);
        Game.clusters[id] = new Cluster(id, data, [], []);
    }

    static addRoom(clusterId, roomName, role){
        _.set(Memory, ['rooms', roomName, 'cluster'], clusterId);
        _.set(Memory, ['rooms', roomName, 'role'], role);
        _.set(Memory, ['rooms', roomName, 'defend'], true);
        _.set(Memory, ['rooms', roomName, 'observe'], true);
        _.set(Memory, ['rooms', roomName, 'reserve'], true);
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

    getResources(){
        if(!this.resources){
            this.resources = _.zipObject(RESOURCES_ALL, _.map(RESOURCES_ALL, resource => {
                return { total: 0, stored: 0, sources: [], storage: [], terminal: [], lab: [], totals: { storage: 0,  terminal: 0, lab: 0 } }
            }));

            for(let storage of this.structures.storage){
                catalogStorage(storage, this.resources);
            }
            for(let storage of this.structures.terminal){
                catalogStorage(storage, this.resources);
            }
            for(let storage of this.structures.lab){
                catalogStorage(storage, this.resources);
            }
        }
        return this.resources;
    }

}

module.exports = Cluster;