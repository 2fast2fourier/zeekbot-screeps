"use strict";

function grpStructFn(result, structure){
    result[structure.room.memory.cluster][structure.structureType].push(structure);
    return result;
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
    constructor(id, data, creeps, rooms, structures){
        Object.assign(this, data);
        this.id = id;
        this.rooms = rooms;
        this.creeps = creeps;

        this.maxSpawn = 0;
        this.maxRCL = 0;

        this.structures = structures;

        this._found = {};
        this._foundAll = {};
        this._roleRooms = {
            core: [],
            harvest: [],
            keep: [],
            reserve: []
        };
        this.roles = this._roleRooms;

        this._jobs = {};
        this._hydratedJobs = {};
        this._profile = {};
        this._longprofile = {};

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

        var start = Game.cpu.getUsed();
        if(Game.intervalOffset(50, 1)){
            let energy = _.filter(this.findAll(FIND_DROPPED_RESOURCES), { resourceType: RESOURCE_ENERGY });
            let containers = _.filter(this.getAllStructures([STRUCTURE_CONTAINER, STRUCTURE_STORAGE, STRUCTURE_LINK]), struct => struct.getResource(RESOURCE_ENERGY) > 0);
            let totalEnergy = _.sum(_.map(energy, 'amount')) + _.sum(_.map(containers, struct => struct.getResource(RESOURCE_ENERGY)));
            this.update('totalEnergy', totalEnergy);
            this.state.totalEnergy = totalEnergy;
            this.profile('energy', this.totalEnergy);
        }
        Game.profile('totalEnergy', Game.cpu.getUsed() - start);
    }

    static init(){
        Memory.bootstrap = false;
        let creeps = _.groupBy(Game.creeps, 'memory.cluster');
        let rooms = _.groupBy(Game.rooms, 'memory.cluster');
        var structTemplate = _.mapValues(Memory.clusters, cluster => {
            return {
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
        });
        let structures = _.reduce(Game.structures, grpStructFn, structTemplate);
        Game.clusters = _.mapValues(Memory.clusters, (data, name) => new Cluster(name, data, creeps[name], rooms[name], structures[name]));

        Cluster.processClusterFlags();
        _.forEach(Game.clusters, cluster => {
            if(cluster.maxRCL < 3 || _.size(cluster.structures.spawn) == 0){
                Memory.bootstrap = cluster.id;
                cluster.bootstrap = true;
            }
            if(Game.interval(30)){
                Cluster.cleanupTags(cluster);
            }
            if(Game.intervalOffset(200, 4)){
                let roomLabs = _.mapValues(_.groupBy(cluster.structures.lab, 'pos.roomName'), (labs, roomName) => _.filter(labs, lab => !cluster.boost[lab.id]));
                roomLabs = _.pick(roomLabs, labs => _.get(_.first(labs), 'room.terminal', false));
                let labs = _.pick(_.mapValues(roomLabs, (labs, roomName) => _.map(_.sortBy(labs, lab => (lab.inRangeToAll(labs, 2) ? 'a' : 'z') + lab.id), 'id')), labs => labs.length > 2);
                cluster.update('labs', _.values(labs));
                cluster.state.labs = labs;
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
            let parts = flag.name.split('-');
            let tag = parts[1];
            let target = Cluster.getFlagTarget(flag);
            if(target && target.room && target.room.hasCluster()){
                if(parts.length > 2 && parts[2] == 'remove'){
                    console.log('Removed tag:', tag, 'from', target);
                    target.room.getCluster().removeTag(tag, target.id);
                }else{
                    console.log('Added tag:', tag, 'to', target);
                    target.room.getCluster().addTag(tag, target.id);
                }
                flag.remove();
            }else if(Game.interval(25)){
                console.log('cannot find flag target', flag.pos);
            }
        }
        for(let flag of Flag.getByPrefix('boost')){
            let parts = flag.name.split('-');
            let type = parts[1];
            let target = Cluster.getFlagTarget(flag);
            if(target && target.room.hasCluster() && (type == 'remove' || Game.boosts[type])){
                let cluster = target.room.getCluster();
                if(type == 'remove'){
                    delete cluster.boost[target.id];
                    console.log("Removing boost from", target);
                }else{
                    cluster.boost[target.id] = type;
                    console.log("Setting", target, "to boost", type, '-', Game.boosts[type]);
                }
            }
            flag.remove();
        }
    }

    static getFlagTarget(flag){
        if(!flag.room){
            return undefined;
        }
        return _.first(_.filter(flag.pos.lookFor(LOOK_STRUCTURES), struct => struct.structureType != STRUCTURE_ROAD && struct.structureType != STRUCTURE_RAMPART));
    }

    static createCluster(id){
        //tags: stockpile, input, output, boost
        let data = {
            assignments: {},
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
            stats: {},
            statscount: {},
            longstats: {},
            longcount: {},
            state: {},
            cache: {}
        };
        _.set(Memory, ['clusters', id], data);
        if(Game.clusters){
            Game.clusters[id] = new Cluster(id, data, [], []);
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
            harvest: role != 'reserve'
        });
        if(role == 'core'){
            _.set(Memory, ['rooms', roomName, 'claim'], true);
        }else if(_.has(Memory, ['rooms', roomName, 'claim'])){
            delete Memory.rooms[roomName].claim;
        }
    }

    changeRole(roomName, newRole){
        Cluster.setRole(roomName, newRole, true);
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

    get tagged(){
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
                stored: 0,
                sources: [],
                storage: [],
                terminal: [],
                lab: [],
                totals: {
                    storage: 0,
                    terminal: 0,
                    lab: 0
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
        this.state.energy = this._resources.energy.totals.storage / (600000 * this.structures.storage.length);
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

    get damaged(){
        if(!this._damaged){
            if(!this.work.repair || this.work.repair.update <= Game.time){
                let totals = {
                    heavy: 0,
                    moderate: 0,
                    light: 0,
                    total: 0
                }
                let targets = _.groupBy(this.findAll(FIND_STRUCTURES), struct => {
                    var damage = struct.getMaxHits() - struct.hits;
                    if(damage > 30000){
                        totals.heavy += damage;
                        return 'heavy';
                    }
                    if(damage > 500){
                        totals.moderate += damage;
                        return 'moderate';
                    }
                    if(damage > 0){
                        totals.light += damage;
                        return 'light';
                    }
                    return 'ignore';
                });
                totals.total = totals.heavy + totals.moderate + totals.light;
                let repairData = {
                    // light: _.map(_.slice(_.sortBy(targets.light, struct => -struct.getDamage()), 0, 20), 'id'),
                    heavy: _.map(_.slice(_.sortBy(targets.heavy, struct => struct.hits / struct.getMaxHits()), 0, 20), 'id'),
                    moderate: _.map(_.slice(_.sortBy(targets.moderate, struct => struct.hits / struct.getMaxHits()), 0, 20), 'id'),
                    damage: totals,
                    update: Game.time + 100
                };
                Memory.clusters[this.id].work.repair = repairData;
                this.work.repair = repairData;
            }
            this._damaged = {
                // light: _.filter(Game.getObjects(this.work.repair.light), target => target && target.getDamage() > 0),
                moderate: _.filter(Game.getObjects(this.work.repair.moderate), target => target && target.getDamage() > 0),
                heavy: _.filter(Game.getObjects(this.work.repair.heavy), target => target && target.getDamage() > 0)
            };
        }
        return this._damaged;
    }

    findClosestCore(dest){
        if(!dest){
            return undefined;
        }
        let closest = false;
        let distance = Infinity;
        for(let room of this.getRoomsByRole('core')){
            if(!room.controller){
                continue;
            }
            let dist = room.controller.pos.getPathDistance(dest);
            if(dist < distance){
                distance = dist;
                closest = room;
            }
        }
        if(closest){
            return {
                room: closest,
                distance
            };
        }
    }

    findNearestRoomByRole(originRoom, role){
        if(!originRoom){
            return undefined;
        }
        let closest = false;
        let distance = Infinity;
        let origin = originRoom.controller ? originRoom.controller.pos : new RoomPosition(25, 25, originRoom.name);
        for(let room of this.getRoomsByRole(role)){
            let target = room.controller ? room.controller.pos : new RoomPosition(25, 25, room.name);
            let dist = origin.getPathDistance(target)
            if(dist < distance){
                distance = dist;
                closest = room;
            }
        }
        if(closest){
            return {
                room: closest,
                distance
            };
        }
    }

    profile(type, value){
        var count = this.statscount[type];
        if(count === undefined){
            this.stats[type] = value;
            this.statscount[type] = 1;
        }else{
            this.stats[type] = (this.stats[type] * count + value)/(count + 1);
            this.statscount[type]++;
        }
    }

    profileAdd(type, value){
        this._profile[type] = _.get(this._profile, type, 0) + value;
    }

    longterm(type, value){
        var count = this.longcount[type];
        if(count === undefined){
            this.longstats[type] = value;
            this.longcount[type] = 1;
        }else{
            this.longstats[type] = (this.longstats[type] * count + value)/(count + 1);
            this.longcount[type]++;
        }
    }

    longtermAdd(type, value){
        this._longprofile[type] = _.get(this._longprofile, type, 0) + value;
    }

    finishProfile(){
        _.forEach(this._profile, (value, type) => this.profile(type, value));
        _.forEach(this._longprofile, (value, type) => this.longterm(type, value));
    }

    processStats(){
        if(!this.longstats){
            this.update('longstats', {});
            this.update('longcount', {});
        }
        var output = this.id + ':';
        output += ' damage: ' + _.get(this, 'work.repair.damage.heavy', 0) + ' / ' + _.get(this, 'work.repair.damage.moderate', 0) + '\n';
        _.forEach(this.stats, (value, type)=>{
            output += ' '+type+': ' + value.toFixed(2);
            this.longterm(type, value);
        });
        console.log(output);
        this.update('stats', {});
        this.update('statscount', {});
    }

    processLongterm(){
        var output = this.id + ':\n';
        _.forEach(this.getRoomsByRole('core'), room =>{
            var level = _.get(room, 'controller.level', Infinity);
            if(level < 8){
                var percent = (_.get(room, 'controller.progress', 0) / _.get(room, 'controller.progressTotal', 1));
                output += ' ' + room.name + ': ' + level + ' - ' + percent.toFixed(2) + '\n';
            }
        });
        output += ' damage: ' + _.get(this, 'work.repair.damage.heavy', 0) + ' / ' + _.get(this, 'work.repair.damage.moderate', 0) + '\n';
        _.forEach(this.longstats, (value, type)=>{
            output += ' '+type+': ' + value.toFixed(2)+'\n';
        });
        console.log('LT:', output);
        Game.notify(output);
        this.update('longstats', {});
        this.update('longcount', {});
    }

    getGatherPoints(){
        return _.map(this.roles.core, room => room.memory.gather
                        ? new RoomPosition(room.memory.gather.x, room.memory.gather.y, room.memory.gather.roomName)
                        : new RoomPosition(25, 25, room.name));
    }

}

module.exports = Cluster;