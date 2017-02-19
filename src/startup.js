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

    static processFlags(){
        let flags = Flag.getByPrefix('act');
        // console.log(flags, Flag.getByPrefix);
        _.forEach(flags, flag =>{
            let parts = flag.name.split('-');
            switch(parts[1]){
                case 'newcluster':
                    if(!parts[2]){
                        console.log('Missing cluster name!');
                    }else{
                        Cluster.createCluster(parts[2]);
                        console.log('Created cluster:', parts[2]);
                    }
                    flag.remove();
                    break;
                case 'cluster':
                //act-cluster-Home-harvest
                    let cluster = Game.clusters[parts[2]];
                    if(!cluster){
                        console.log('Invalid cluster name!', parts[2]);
                    }else if(_.get(Memory, ['rooms', roomName, 'cluster'], false) != parts[2]){
                        let role = parts.length > 3 ? parts[3] : 'harvest';
                        Cluster.addRoom(cluster.id, flag.pos.roomName, role);
                        console.log('Added', flag.pos.roomName, 'to cluster', cluster.id, 'role:', role);
                    }
                    flag.remove();
                    break;
                default:
                    console.log('Unknown action:', parts[1]);
                    flag.remove();
                    break;
            }
        });
    }
}

module.exports = Startup;