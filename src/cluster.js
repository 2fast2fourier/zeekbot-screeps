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