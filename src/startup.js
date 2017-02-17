"use strict";

let VERSION = 1;
let STAT_INTERVAL = 100;

class Startup {
    static start(){
        var ver = _.get(Memory, 'ver', 0);
        if(ver < VERSION){
            Startup.migrate(ver);
        }

        if(Game.interval(STAT_INTERVAL)){
            Startup.shortStats();
            Startup.longStats();
        }
    }

    static convert(){

    }

    static migrate(ver){
        console.log('Migrating from version', ver, 'to', VERSION);
        switch(ver){
            case 1:
            Memory.clusters = {};
            if(Memory.memoryVersion){
                console.log('Converting last-gen memory!');
                Startup.convert();
                delete Memory.memoryVersion;
            }
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

    shortStats(){

    }

    longStats(){

    }
}

module.exports = Startup;