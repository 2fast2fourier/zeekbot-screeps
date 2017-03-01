"use strict";

let VERSION = 1;
let STAT_INTERVAL = 100;

const Cluster = require('./cluster');

class Startup {
    static start(){
        var ver = _.get(Memory, 'ver', 0);
        if(ver < VERSION){
            Startup.migrate(ver);
        }

        if(Game.interval(STAT_INTERVAL)){
            Startup.longStats();
            Startup.shortStats();
        }
    }

    static convert(){

    }

    static migrate(ver){
        console.log('Migrating from version', ver, 'to', VERSION);
        switch(ver){
            case 1:
            Memory.clusters = {};
            Memory.uid = 1;
            if(Memory.memoryVersion){
                console.log('Converting last-gen memory!');
                Startup.convert();
                delete Memory.memoryVersion;
            }
            Memory.stats = { profile: {}, profileCount: {}};
            Memory.jobs = {};
            Memory.pathable = {};
            Memory.cache = {
                roompos: {},
                path: {}
            };
            //TODO init memory
            // case 2:
            //TODO add migration
            // case 3:
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
        Game.notify('Successfully migrated from version '+ver+' to '+version);
    }

    static shortStats(){
        _.forEach(Memory.stats.profile, (value, type)=>console.log(type+':', value));
        Memory.stats = {
            profile: {},
            profileCount: {}
        }
    }

    static longStats(){

    }

    static processActions(){
        let flags = Flag.getByPrefix('cluster');
        for(let flag of flags){
            let roomName = flag.pos.roomName;
            let parts = flag.name.split('-');
            let action = parts[1];
            let target = parts[2];
            console.log('Processing:', roomName, action);
            let room = Game.rooms[roomName];

            switch(action){
                case 'new':
                    if(!parts[2]){
                        console.log('Missing cluster name!');
                    }else{
                        Cluster.createCluster(target);
                        console.log('Created cluster:', target);
                    }
                    break;
                case 'assign':
                //cluster-assign-Home-harvest
                    let cluster = Game.clusters[target];
                    if(!cluster){
                        console.log('Invalid cluster name!', target);
                    }else if(_.get(Memory, ['rooms', roomName, 'cluster'], false) != target){
                        if(_.get(Memory, ['rooms', roomName, 'cluster'], false) == target){
                            break;
                        }
                        let role = parts.length > 3 ? parts[3] : 'harvest';
                        Cluster.addRoom(cluster.id, roomName, role);
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
                            Cluster.addRoom(target, roomName, parts[3]);
                            if(room){
                                _.forEach(room.find(FIND_MY_CREEPS), creep => {
                                    creep.memory.cluster = target;
                                });
                            }
                            console.log('Reassigned room to cluster:', target, roomName, parts[3]);
                        }
                    break;
                default:
                    console.log('Unknown action:', parts[1]);
                    break;
            }
            console.log('Finished:', action, roomName);
            flag.remove();
        }
    }
}

module.exports = Startup;