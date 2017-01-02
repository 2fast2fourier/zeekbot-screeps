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

    getStorageOffset(creep){
        return 1 - this.catalog.getStoragePercent(creep);
    }

    calculateBoostedTotal(creep, part, boost, effect){
        var partCount = creep.getActiveBodyparts(part);
        var boosted = _.get(creep.memory.boosted, boost, 0);
        return partCount - boosted + boosted * _.get(BOOSTS, [part, boost, effect], 0);
    }

    move(creep, target){
        if(this.moveOpts){
            return creep.moveTo(target, this.moveOpts);
        }
        if(creep.memory.avoidUntil > Game.time && Game.cpu.bucket > 5000){
            var range = 5;
            return creep.moveTo(target, { reusePath: 15, costCallback: (roomName, costMatrix) => {
                var avoidList = this.catalog.getAvoid({ roomName });
                if(!avoidList){
                    return;
                }
                for(var avoid of avoidList){
                    var minX = Math.max(0, avoid.x - range);
                    var minY = Math.max(0, avoid.y - range);
                    var maxX = Math.min(49, avoid.x + range);
                    var maxY = Math.min(49, avoid.y + range);
                    for(var iy = minY; iy < maxY; iy++){
                        for(var ix = minX; ix < maxX; ix++){
                            if(ix == minX || ix == maxX || iy == minY || iy == maxY){
                                costMatrix.set(ix, iy, 10);
                            }else{
                                costMatrix.set(ix, iy, 256);
                            }
                        }
                    }
                }
            }});
        }
        
        return creep.moveTo(target, { reusePath: 15 });
    }

    orMove(creep, target, result){
        if(result == ERR_NOT_IN_RANGE){
            this.move(creep, target);
        }
        return result;
    }

    stillValid(creep, opts){
        if(this.idleTimer > 0 && creep.memory.idleCheck > 0 && creep.memory.idleCheck < Game.time){
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
        }
    }
    
    process(creep, opts){ return false; }
    
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