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
        if(!Memory.action){
            return;
        }
        console.log('Processing:', Memory.action);
        let parts = Memory.action.split('-');
        let roomName = parts[0];
        let room = Game.rooms[roomName];
        if(!room){
            delete Memory.action;
            console.log('Invalid room:', roomName);
            return;
        }
        switch(parts[1]){
            case 'newcluster':
                if(!parts[2]){
                    console.log('Missing cluster name!');
                }else{
                    Cluster.createCluster(parts[2]);
                    console.log('Created cluster:', parts[2]);
                }
                break;
            case 'assign':
            //room-assign-Home-harvest
                let cluster = Game.clusters[parts[2]];
                if(!cluster){
                    console.log('Invalid cluster name!', parts[2]);
                }else if(_.get(Memory, ['rooms', roomName, 'cluster'], false) != parts[2]){
                    let role = parts.length > 3 ? parts[3] : 'harvest';
                    Cluster.addRoom(cluster.id, roomName, role);
                    console.log('Added', roomName, 'to cluster', cluster.id, 'role:', role);
                }
                break;
            case 'reassign':
                if(!parts[2]){
                    console.log('Missing cluster name!');
                }else{
                    Cluster.addRoom(parts[2], roomName, parts[3]);
                    _.forEach(room.find(FIND_MY_CREEPS), creep => {
                        creep.memory.cluster = parts[2];
                    });
                    console.log('Reassigned room to cluster:', parts[2], roomName, parts[3]);
                }
                break;
            default:
                console.log('Unknown action:', parts[1]);
                break;
        }
        console.log('Finished:', Memory.action);
        delete Memory.action;
    }
}

module.exports = Startup;