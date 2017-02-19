"use strict";

class Cluster {
    constructor(id, data, creeps){
        Object.assign(this, data);
        this.id = id;
        this.rooms = _.compact(_.map(_.keys(this.roles), roomName=>Game.rooms[roomName]));
        this.roleRooms = {};
        this.spawns = [];
        this.maxSpawn = 0;
        this.maxRCL = 0;
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
            this.maxRCL = Math.max(this.maxRCL, _.get(room, 'controller.level', 0));
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
        if(Game.interval(25)){
            Cluster.processClusterFlags();
        }
    }

    static processClusterFlags(){
        let flags = Flag.getByPrefix('tag');
        _.forEach(flags, flag=>{
            if(flag.room && flag.room.cluster){
                let parts = flag.name.split('-');
                let target = _.first(_.filter(flag.pos.lookFor(LOOK_STRUCTURES), struct => struct.structureType == parts[1]));
                if(target){
                    console.log('Tagging', target, parts[2], 'for cluster', flag.room.cluster.id);
                    flag.room.cluster.addTag(parts[2], target.id);
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
            roles: {},
            work: {},
            tags: {}
        };
        _.set(Memory, ['clusters', id], data);
        Game.clusters[id] = new Cluster(id, data, []);
    }

    static addRoom(clusterId, roomName, role){
        Memory.clusters[clusterId].roles[roomName] = role;
    }

    addTag(tag, id){
        if(!this.tags[tag]){
            this.tags[tag] = [];
        }
        if(!_.includes(this.tags[tag], id)){
            this.tags[tag].push(id);
        }
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

    getTaggedStructures(){
        if(!this._tagged){
            this._tagged = _.mapValues(this.tags, (list, tag)=>Game.getObjects(list));
        }
        return this._tagged;
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