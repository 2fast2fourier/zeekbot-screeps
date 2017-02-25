"use strict";

var BaseAction = require('./base');

class AvoidAction extends BaseAction {
    constructor(){
        super('avoid');
        this.range = 6;
    }

    shouldBlock(cluster, creep, opts){
        var hostiles = cluster.find(creep.room, FIND_HOSTILE_CREEPS);
        if(hostiles.length > 0){
            let avoidTargets = [];
            for(var enemy of hostiles){
                if(creep.pos.getRangeTo(enemy) <= this.range){
                    avoidTargets.push({ pos: enemy.pos, range: this.range + 2, enemy });
                }
            }
            if(avoidTargets.length > 0){
                return { type: this.type, data: avoidTargets };
            }
        }
        return false;
    }

    blocked(cluster, creep, opts, block){
        var result = PathFinder.search(creep.pos, block, { flee: true });
        creep.moveByPath(result.path);
    }

}


module.exports = AvoidAction;