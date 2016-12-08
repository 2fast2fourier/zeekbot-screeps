"use strict";

var RoomUtil = require('../roomutil');
var { BaseBehavior } = require('./base');

class AttackBehavior extends BaseBehavior {

    stillValid(creep, data, catalog){
        return true;
    }

    bid(creep, data, catalog){
        return 0;
    }

    start(creep, data, catalog){
        return true;
    }

    process(creep, data, catalog){
        var sayings = ['~biff~', 'bam!', 'zing'];
        var hostiles = catalog.getHostileCreeps(creep.room);
        if(data.maxRange > 0 || creep.hits < creep.hitsMax){
            var range = data.maxRange;
            if(creep.hits < creep.hitsMax){
                range = 10;
            }
            hostiles = _.filter(hostiles, hostile => creep.pos.getRangeTo(hostile) < data.maxRange);
        }
        // var hostileStructures = catalog.getHostileStructures(creep.room);
        var targetFlag;
        if(data.flag === true){
            targetFlag = Game.flags[creep.memory.flag];
        }else{
            targetFlag = Game.flags[_.get(Memory, 'targetFlag', _.get(data, 'flag', 'Base'))];
        }
        if(!targetFlag){
            targetFlag = Game.flags['Base'];
        }
        var manualTarget = _.get(Memory, 'manualTarget', false);
        var target = false;
        if(targetFlag && (creep.pos.roomName != targetFlag.pos.roomName || (hostiles.length < 1 && !manualTarget))){
            if(creep.pos.getRangeTo(targetFlag) > 2){
                creep.moveTo(targetFlag);
            }
        }else if(manualTarget){
            target = Game.getObjectById(manualTarget);
            if(!target){
                Memory.manualTarget = false;
            }
        }else if(hostiles.length > 0){
            var enemies = _.sortBy(hostiles, (target)=>creep.pos.getRangeTo(target));
            target = enemies[0];
        }
        // else if(hostileStructures.length > 0){
        //     var enemies = _.sortBy(hostileStructures, (target)=>creep.pos.getRangeTo(target));
        //     target = enemies[0];
        //     // console.log(target);
        // }
        if(data.ranged && creep.pos.getRangeTo(target) < 2){// && RoomUtil.intactPartCount('move') > 0){
            creep.move((creep.pos.getDirectionTo(target)+4)%8);
        }
        if(target){
            var result;
            if(data.ranged){
                result = creep.rangedAttack(target);
            }else{
                result = creep.attack(target);
            }
            if(result == ERR_NOT_IN_RANGE) {
                creep.moveTo(target);
            }else if(result == OK){
                creep.say(sayings[Math.floor(Math.random()*sayings.length)]);
            }
        }
    }
};

module.exports = AttackBehavior;