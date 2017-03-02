"use strict";

var BaseAction = require('./base');

class AvoidAction extends BaseAction {
    constructor(){
        super('avoid');
        this.range = 6;
    }

    shouldBlock(cluster, creep, opts){
        var idle = false;
        var hostiles = cluster.find(creep.room, FIND_HOSTILE_CREEPS);
        if(creep.room.memory.keep){
            let keeps = _.filter(cluster.find(creep.room, FIND_HOSTILE_STRUCTURES), keep => keep.ticksToSpawn < 10);
            if(keeps.length > 0){
                hostiles = hostiles.concat(keeps);
            }
        }
        if(hostiles.length > 0){
            let avoidTargets = [];
            for(var enemy of hostiles){
                let distance = creep.pos.getRangeTo(enemy);
                if(distance == this.range){
                    idle = true;
                }else if(distance < this.range){
                    avoidTargets.push({ pos: enemy.pos, range: this.range + 2, enemy });
                }
            }
            if(avoidTargets.length > 0){
                return { type: this.type, data: avoidTargets };
            }else if(idle && !Game.interval(5)){
                return { type: this.type, data: 'idle' };
            }
        }
        return false;
    }

    blocked(cluster, creep, opts, block){
        if(block != 'idle'){
            var result = PathFinder.search(creep.pos, block, { flee: true });
            creep.moveByPath(result.path);
        }
    }

}


module.exports = AvoidAction;