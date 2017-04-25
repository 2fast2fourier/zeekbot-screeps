"use strict";

function catalogGlobal(resources, struct){
    if(struct.structureType == STRUCTURE_STORAGE || struct.structureType == STRUCTURE_TERMINAL){
        var stored = struct.getResourceList();
        for(let type in stored){
            let amount = stored[type];
            resources[type].global += amount;
            resources[type].globals[struct.structureType] += amount;
        }
    }
}

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
            harvest: [],
            keep: [],
            reserve: []
        };

        this.roomflags = {
            defend: [],
            reserve: [],
            observe: [],
            claim: [],
            autobuild: [],
            keep: [],
            harvest: []
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
        // console.log(Game.hegemony.structures.storage.length);
        Cluster.processClusterFlags();
        _.forEach(Game.clusters, cluster => {
            if(cluster.maxRCL < 2 || _.size(cluster.structures.spawn) == 0){
                Memory.bootstrap = cluster.id;
                cluster.bootstrap = true;
            }
            if(Game.interval(30)){
                Cluster.cleanupTags(cluster);
            }
            if(Game.interval(2000)){
                let roomLabs = _.mapValues(_.groupBy(cluster.structures.lab, 'pos.roomName'), (labs, roomName) => _.filter(labs, lab => !lab.hasTag('boost')));
                let labs = _.pick(_.mapValues(roomLabs, (labs, roomName) => _.map(_.sortBy(labs, lab => (lab.inRangeToAll(labs, 2) ? 'a' : 'z') + lab.id), 'id')), labs => labs.length > 2);
                cluster.update('labs', _.values(labs));
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
        if(Memory.removetag){
            let parts = Memory.removetag.split('-');
            let tag = parts[0];
            let target = Game.getObjectById(parts[1]);
            if(target && target.room && target.room.hasCluster()){
                console.log('Removed tag:', tag, 'from', target);
                target.room.getCluster().removeTag(tag, target.id);
            }else{
                console.log('could not find tag target', target, parts[1]);
            }
            delete Memory.removetag;
        }
        for(let flag of Flag.getByPrefix('tag')){
            console.log('Processing tag:', flag.name);
            let parts = flag.name.split('-');
            let tag = parts[1];
            let target = Cluster.getFlagTarget(flag);
            if(target && target.room && target.room.hasCluster()){
                console.log('Added tag:', tag, 'to', target);
                target.room.getCluster().addTag(tag, target.id);
            }else{
                console.log('could not find tag target', target, flag.pos);
            }
            flag.remove();
        }
        for(let flag of Flag.getByPrefix('boost')){
            let parts = flag.name.split('-');
            let type = parts[1];
            let target = Cluster.getFlagTarget(flag);
            if(target && target.room.hasCluster() && Game.boosts[type]){
                let cluster = target.room.getCluster();
                cluster.boost[target.id] = type;
                if(target.hasTag('production')){
                    cluster.removeTag('production', target.id);
                }
                console.log("Setting", target, "to boost", type, '-', Game.boosts[type]);
            }
            flag.remove();
        }
    }

    static getFlagTarget(flag){
        return _.first(_.filter(flag.pos.lookFor(LOOK_STRUCTURES), struct => struct.structureType != STRUCTURE_ROAD && struct.structureType != STRUCTURE_RAMPART));
    }

    static createCluster(id){
        //tags: stockpile, input, output, boost
        let data = {
            assignments: {},
            labs: [],
            quota: {},
            reaction: {},
            tags: {},
            transfer: {},
            work: {},
            totalEnergy: 0,
            opts: {
                repair: 250000
            },
            boost: {},
            stats: {}
        };
        _.set(Memory, ['clusters', id], data);
        if(Game.clusters){
            Game.clusters[id] = new Cluster(id, data, [], [], Game.hegemony);
        }
    }

    static addRoom(clusterId, roomName, role, autobuild){
        _.set(Memory, ['rooms', roomName, 'cluster'], clusterId);
        Cluster.setRole(roomName, role, autobuild);
        console.log('Added room', roomName, 'to', clusterId, role, autobuild ? 'with autobuild' : '');
    }

    static setRole(roomName, role, autobuild){
        _.set(Memory, ['rooms', roomName, 'role'], role);
        _.assign(Memory.rooms[roomName], {
            defend: true,
            observe: true,
            reserve: role != 'keep',
            autobuild: role != 'reserve' && autobuild,
            keep: role == 'keep',
            harvest: role != 'core' && role != 'reserve'
        });
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

    removeTag(tag, id){
        if(this.tags[tag]){
            this.tags[tag] = _.pull(this.tags[tag], id);
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

    get resources(){
        if(!this._resources){
            this.initResources();
        }
        return this._resources;
    }

    initResources(){
        this._resources = _.zipObject(RESOURCES_ALL, _.map(RESOURCES_ALL, resource => {
            return {
                total: 0,
                global: 0,
                stored: 0,
                sources: [],
                storage: [],
                terminal: [],
                lab: [],
                totals: {
                    storage: 0,
                    terminal: 0,
                    lab: 0
                },
                globals: {
                    storage: 0,
                    terminal: 0
                }
            };
        }));

        for(let storage of this.structures.storage){
            catalogStorage(storage, this._resources);
        }
        for(let storage of this.structures.terminal){
            catalogStorage(storage, this._resources);
        }
        for(let storage of this.structures.lab){
            catalogStorage(storage, this._resources);
        }
        _.forEach(Game.structures, catalogGlobal.bind(this, this._resources));
    }

    getResources(){
        return this.resources;
    }

    get boostMinerals(){
        if(!this._boostMinerals){
            this._boostMinerals = _.reduce(this.boost, (result, type, labId)=>{
                var resource = Game.boosts[type];
                var lab = Game.getObjectById(labId);
                if(lab && lab.mineralType == resource){
                    result[resource] = lab.mineralAmount;
                }
                return result;
            }, {});
        }
        return this._boostMinerals;
    }

}

module.exports = Cluster;