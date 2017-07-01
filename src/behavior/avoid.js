"use strict";

var BaseAction = require('./base');

class AvoidAction extends BaseAction {
    constructor(){
        super('avoid');
        this.range = 6;
    }

    shouldBlock(cluster, creep, opts){
        var idle = false;
        if(creep.memory.gather){
            var gather = creep.memory.gather;
            var originalRoom = Game.matrix.rooms[creep.memory.fleeFrom];
            if(originalRoom && originalRoom.hostiles.length == 0){
                delete creep.memory.gather;
                delete creep.memory.gatherRange;
                delete creep.memory.fleeFrom;
                delete creep.memory.snuggled;
            }else{
                let target = new RoomPosition(gather.x, gather.y, gather.roomName);
                return { type: this.type, data: { gather: true, target, range: creep.memory.gatherRange } };
            }
        }
        var roomData = Game.matrix.rooms[creep.room.name];
        if(roomData.safemode || (roomData.armed.length == 0 && !roomData.keeper)){
            return false;
        }
        var hostiles = roomData.armed;
        if(roomData.keeper){
            let keeps = _.filter(cluster.find(creep.room, FIND_HOSTILE_STRUCTURES), keep => keep.ticksToSpawn < 10);
            if(keeps.length > 0){
                hostiles = hostiles.concat(keeps);
            }
        }
        if(hostiles.length > 0){
            if(roomData.fleeTo){
                creep.memory.gather = roomData.fleeTo;
                creep.memory.gatherRange = roomData.fleeToRange;
                creep.memory.fleeFrom = creep.room.name;
                return { type: this.type, data: { gather: true, target: roomData.fleeTo, range: roomData.fleeToRange } };
            }
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
        if(block.gather){
            let distance = creep.pos.getRangeTo(block.target);
            if(distance > block.range){
                this.move(creep, { pos: block.target });
            }else if(distance > 2 && !creep.memory.snuggled){
                this.move(creep, { pos: block.target });
                creep.memory.snuggled = true;
            }
        }else if(block != 'idle'){
            var result = PathFinder.search(creep.pos, block, { flee: true, range: this.range });
            creep.moveByPath(result.path);
        }
    }

}


module.exports = AvoidAction;