"use strict";

let VERSION = 3;
let STAT_INTERVAL = 100;
let LONGTERM_STAT_INTERVAL = 5000;

const Cluster = require('./cluster');
const creeps = require('./creeps');
const Spawner = require('./spawner');

const creepCPU = function(creep){
    if(!creep.ticksToLive || creep.ticksToLive > 1300){
        return 0;
    }
    if(creep.getActiveBodyparts(CLAIM) > 0){
        return creep.memory.cpu / (500 - creep.ticksToLive);
    }
    return creep.memory.cpu / (1500 - creep.ticksToLive);
}

class Startup {
    static start(){
        var ver = _.get(Memory, 'ver', 0);
        if(ver < VERSION){
            Startup.migrate(ver);
        }

        if(Game.interval(STAT_INTERVAL)){
            Startup.longStats();
            Startup.shortStats();
            var heaviestCreep = _.max(Game.creeps, creepCPU);
            if(heaviestCreep.getActiveBodyparts(CLAIM) > 0){
                console.log(heaviestCreep.name, heaviestCreep.memory.cluster, heaviestCreep.memory.cpu, heaviestCreep.memory.cpu  / (500 - heaviestCreep.ticksToLive));
            }else{
                console.log(heaviestCreep.name, heaviestCreep.memory.cluster, heaviestCreep.memory.cpu, heaviestCreep.memory.cpu  / (1500 - heaviestCreep.ticksToLive));
            }
        }
        if(Game.interval(LONGTERM_STAT_INTERVAL)){
            var msg = 'Statistics: \n';
            _.forEach(Memory.stats.longterm, (value, type)=>{
                if(type != 'count'){
                    msg += type + ': ' + value.toFixed(2) + '\n';
                    console.log('LT', type+':', value.toFixed(2));
                }
            });
            Memory.stats.longterm = {
                count: {}
            }
            Game.notify(msg);
        }
    }

    static convert(){
        _.forEach(Game.rooms, (room, roomName)=>{
            let clusterName = _.get(room, 'memory.cluster', 'Main');
            if(!Memory.clusters[clusterName]){
                Cluster.createCluster(clusterName);
            }
            let role = 'harvest';
            if(room.controller && room.controller.my){
                role = 'core';
            }else if(!room.controller){
                role = 'keep';
            }
            Cluster.addRoom(clusterName, roomName, _.get(room, 'memory.role', role), false);
            for(let creep of room.find(FIND_MY_CREEPS)){
                creep.memory.cluster = clusterName;
            }
        });
        var translateTypes = {
            levelerhauler: 'spawnhauler',
            longhauler: 'harvesthauler',
            picoclaimer: 'reserver',
            picohealer: 'healer',
            meleefighter: 'keeper',
            rangedfighter: 'defender',
            picoobserver: 'observer'
        };
        _.forEach(Game.creeps, creep=>{
            var newType = _.get(translateTypes, creep.memory.type, creep.memory.type);
            if(!creeps[newType]){
                console.log('Cannot translate creep type:', creep.memory.type, newType);
                creep.suicide();
                return;
            }
            let data = creeps[newType];
            _.assign(creep.memory, {
                type: newType,
                job: false,
                jobType: false,
                jobSubType: false,
                jobAllocation: 0,
                quota: data.quota,
                quotaAlloc: Spawner.getAllocation(data, _.first(_.keys(data.parts)))
            });
        });
        delete Memory.transfer;
        delete Memory.production;
        delete Memory.jobs;
        delete Memory.settings;
        delete Memory.linkTransfer;
        delete Memory.resetBehavior;
        delete Memory.standDown;
        delete Memory.upgradedLogic;
        delete Memory.productionTime;
        delete Memory.accessibility;
        delete Memory.debugMisc;
        delete Memory.debugType;
        delete Memory.boost;
        delete Memory.stockpile;
        delete Memory.scaling;
        delete Memory.limits;
        delete Memory.notify;
        delete Memory.reaction;
        delete Memory.watch;
        delete Memory.roomlist;
        delete Memory.keeps;
    }
    
        // var memory = {
        //     type,
        //     version,
        //     cluster: cluster.id,
        //     job: false,
        //     jobType: false,
        //     jobSubType: false,
        //     jobAllocation: 0,
        //     quota: config.quota,
        //     quotaAlloc: Spawner.getAllocation(config, version)
        // };

    static migrate(ver){
        console.log('Migrating from version', ver, 'to', VERSION);
        switch(ver){
            case 0:
                if(!Memory.uid){
                    Memory.uid = 1;
                }
                Memory.stats = { profile: {}, profileCount: {}};
                Memory.cache = {
                    roompos: {},
                    path: {}
                };
                Memory.clusters = {};
                Memory.avoidRoom = {};
                if(Memory.memoryVersion){
                    console.log('Converting last-gen memory!');
                    // let oldMem;
                    try{
                        // oldMem = JSON.stringify(Memory);
                        Startup.convert();
                    }catch(e){
                        console.log(e);
                        // console.log('ERROR Converting last-gen memory! REVERTING MEMORY');
                        // Memory = JSON.parse(oldMem);
                        return;
                    }
                    delete Memory.memoryVersion;
                }
            case 1:
                _.forEach(Memory.clusters, cluster => {
                    cluster.opts = {
                        repair: 500000
                    };
                });
            case 2:
                _.forEach(Memory.clusters, cluster => {
                    delete cluster.observe;
                    cluster.stats = {};
                    cluster.stats.count = {};
                });
                Memory.stats.longterm = {};
                Memory.stats.longterm.count = {};
            case 3:
            //TODO add migration
            // case 4:
            //TODO add migration



            //NOTE: keep break at bottom, intentionally fall through until here.
                break;
            default:
                console.log('Nothing to do here!', ver, 'to', VERSION);
                break;
        }
        Memory.ver = VERSION;
        Game.notify('Successfully migrated from version '+ver+' to '+VERSION);
    }

    static shortStats(){
        _.forEach(Memory.stats.profile, (value, type)=>console.log(type+':', value.toFixed(2)));
        if(Game.cpu.bucket < 9500){
            console.log('bucket:', Game.cpu.bucket);
        }
        var longterm = Memory.stats.longterm;
        Memory.stats.longterm = null;
        Memory.stats = {
            longterm,
            profile: {},
            profileCount: {},
            minerals: _.pick(_.mapValues(Game.federation.resources, 'total'), (amount, type) => type.length == 1 || type.length >= 5)
        }
    }

    static longStats(){
        _.forEach(Memory.stats.profile, (value, type)=>Game.longterm(type, value));
    }

    static processGenericFlags(){
        let flags = Flag.getByPrefix('action');
        for(let flag of flags){
            let roomName = flag.pos.roomName;
            let parts = flag.name.split('-');
            let action = parts[1];
            let target = parts[2];
            switch(action){
                case 'killroom':
                    let confirmFlag = Game.flags['action-killroomconfirm'];
                    let killFlag = Game.flags['action-killroom'];
                    if(flag.room && killFlag && confirmFlag && killFlag.pos.roomName == confirmFlag.pos.roomName){
                        console.log('Killing room', roomName);
                        confirmFlag.remove();
                        killFlag.remove();
                        flag.room.find(FIND_MY_STRUCTURES).map(struct => struct.destroy());
                    }
                    break;
                case 'harvest':
                    Memory.rooms[roomName].harvest = true;
                    flag.remove();
                    break;
                case 'debugroom':
                    console.log(JSON.stringify(Memory.rooms[roomName]));
                    flag.remove();
                    break;
                case 'set':
                    let value = parts[3];
                    if(value == 'true'){
                        value = true;
                    }else if(value == 'false'){
                        value = false;
                    }
                    _.set(Memory.rooms, [roomName, target], value);
                    console.log('Updated', roomName, JSON.stringify(Memory.rooms[roomName]));
                    flag.remove();
                    break;
                case 'destroy':
                    if(flag.room){
                        let range = parts.length > 3 ? _.parseInt(parts[3]) : 1;
                        let targets = flag.pos.findInRange(FIND_STRUCTURES, range, { filter: { structureType: target }});
                        targets.forEach(target => target.destroy());
                        flag.remove();
                    }
                    break;
                case 'removesites':
                    if(flag.room){
                        let range = parts.length > 3 ? _.parseInt(parts[3]) : 50;
                        let targets = flag.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, range, { filter: { structureType: target }});
                        targets.forEach(target => target.remove());
                        flag.remove();
                    }
                    break;
                case 'gather':
                    _.set(Memory.rooms, [flag.pos.roomName, 'gather'], flag.pos);
                    console.log('Set gather point:', flag.pos);
                    flag.remove();
                    break;
            }
        }
    }

    static processActions(){
        let flags = Flag.getByPrefix('cluster');
        for(let flag of flags){
            let roomName = flag.pos.roomName;
            let parts = flag.name.split('-');
            let action = parts[1];
            let target = parts[2];
            let room = Game.rooms[roomName];

            switch(action){
                case 'new':
                    if(!parts[2]){
                        console.log('Missing cluster name!');
                    }else if(!Game.clusters[target]){
                        Cluster.createCluster(target);
                        console.log('Created cluster:', target);
                    }
                    break;
                case 'assign':
                    let cluster = Game.clusters[target];
                    if(!cluster){
                        console.log('Invalid cluster name!', target);
                    }else if(_.get(Memory, ['rooms', roomName, 'cluster'], false) != target){
                        if(_.get(Memory, ['rooms', roomName, 'cluster'], false) == target){
                            break;
                        }
                        let role = parts.length > 3 ? parts[3] : 'harvest';
                        Cluster.addRoom(cluster.id, roomName, role, true);
                        console.log('Added', roomName, 'to cluster', cluster.id, 'role:', role);
                    }
                    break;
                case 'reassign':
                    if(!target){
                        console.log('Missing cluster name!');
                    }else{
                        if(_.get(Memory, ['rooms', roomName, 'cluster'], false) == target){
                            break;
                        }
                        Cluster.addRoom(target, roomName, parts[3], _.get(room, 'memory.autobuild', true));
                        if(room){
                            _.forEach(room.find(FIND_MY_CREEPS), creep => {
                                creep.memory.cluster = target;
                            });
                        }
                        console.log('Reassigned room to cluster:', target, roomName, parts[3]);
                    }
                    break;
                case 'unassign':
                    console.log('Removed room', roomName, 'from cluster.');
                    delete Memory.rooms[roomName];
                    break;
                case 'role':
                    if(!target){
                        console.log('Missing role name!');
                    }else{
                        console.log('Changing role for room:', roomName, 'to', target);
                        Cluster.setRole(roomName, target, true);
                    }
                    break;
                default:
                    console.log('Unknown action:', parts[1]);
                    break;
            }
            flag.remove();
        }

        Startup.processGenericFlags();
    }
}

module.exports = Startup;