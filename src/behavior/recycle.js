"use strict";

var BaseAction = require('./base');
var Util = require('../util');

class RecycleAction extends BaseAction {
    constructor(){
        super('recycle');
    }

    shouldBlock(cluster, creep, opts){
        if(creep.memory.jobType == 'idle'){
            if(creep.memory.idleTime === undefined){
                creep.memory.idleTime = 0;
            }
            creep.memory.idleTime++;
            if(creep.memory.idleTime > 100){
                if(!creep.memory.recycle){
                    creep.memory.recycle = _.get(Util.closest(creep, cluster.structures.spawn), 'id');
                }
                return { type: this.type, data: creep.memory.recycle };
            }
        }
        return false;
    }

    blocked(cluster, creep, opts, recycleId){
        var target = Game.getObjectById(recycleId);
        if(target){
            if(creep.pos.getRangeTo(target) > 1){
                this.move(creep, target);
            }else{
                target.recycleCreep(creep);
                // Game.message('recycle', 'Recycled '+creep.name+' - '+creep.pos);
            }
        }else{
            Game.notify('No recycle target in cluster: ' + cluster.id);
            creep.suicide();
        }
    }

}


module.exports = RecycleAction;