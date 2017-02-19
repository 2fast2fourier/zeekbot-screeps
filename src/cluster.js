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
        if(Game.interval(25)){
            Cluster.processClusterFlags();
        }
    }

    static processClusterFlags(){
        let flags = Flag.getByPrefix('tag');
        _.forEach(flags, flag=>{
            if(flag.room && flag.room.hasCluster()){
                let parts = flag.name.split('-');
                let target = _.first(_.filter(flag.pos.lookFor(LOOK_STRUCTURES), struct => struct.structureType == parts[1]));
                if(target){
                    console.log('Tagging', target, parts[2], 'for cluster', flag.room.getCluster().id);
                    flag.room.getCluster().addTag(parts[2], target.id);
                }else{
                    console.log('Could not find structure', parts[1], 'to tag', parts[2]);
                }
            }else{
                console.log('Cannot tag this room!', flag.pos.roomName, flag.name);
            }
            flag.remove();
        });
    }

    static createCluster(id){
        let data = {
            quota: { energyminer: 1, spawnhauler: 1, build: 1, upgrade: 1 },
            work: {},
            tags: {}
        };
        _.set(Memory, ['clusters', id], data);
        Game.clusters[id] = new Cluster(id, data, [], []);
    }

    static addRoom(clusterId, roomName, role){
        _.set(Memory, ['rooms', roomName, 'cluster'], clusterId);
        _.set(Memory, ['rooms', roomName, 'role'], clusterId);
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

    updateQuota(quota){
        // console.log('quotas', this.id, JSON.stringify(quota));
        this.quota = quota;
        Memory.clusters[this.id].quota = quota;
    }

}
Cluster.prototype.ROLE_CORE = 'core';
Cluster.prototype.ROLE_HARVEST = 'harvest';
Cluster.prototype.ROLE_RESERVE = 'reserve';

module.exports = Cluster;