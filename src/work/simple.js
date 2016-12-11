"use strict";

class SimpleWorker {
    constructor(catalog, type, opts){
        this.catalog = catalog;
        this.type = type;
        this.distanceWeight = 50;
        if(opts){
            _.assign(this, opts);
        }
    }

    getType(){
        return this.type;
    }

    getEnergyOffset(creep){
        return 1 - this.catalog.getResourcePercent(creep, RESOURCE_ENERGY);
    }

    getResourceOffset(creep, type){
        return 1 - this.catalog.getResourcePercent(creep, type);
    }

    stillValid(creep, opts){
        if(this.idleTimer > 0 && creep.memory.idleCheck > 0 && creep.memory.idleCheck < Game.time){
            console.log('idle', this.type);
            return false;
        }
        if(this.requiresEnergy){
            return this.catalog.getResource(creep, RESOURCE_ENERGY) > 0;
        }else{
            return true;
        }
    }

    bid(creep, opts){
        if(this.requiresEnergy){
            return this.catalog.getResource(creep, RESOURCE_ENERGY) > 0;
        }
        return true;
    }
    
    start(creep, opts){
        if(this.chatty){
            creep.say(this.type);
        }
        if(this.debug){
            console.log('start',this.type)
        }
        if(this.idleTimer > 0){
            creep.memory.idleCheck = Game.time + this.idleTimer;
            console.log('setidle', creep.memory.idleCheck);
        }
    }
    
    process(creep, opts){ }
    
    stop(creep, bid, opts){
        if(this.debug){
            console.log('stop',this.type)
        }
        if(this.idleTimer > 0){
            delete creep.memory.idleCheck;
        }
    }

}

module.exports = SimpleWorker;