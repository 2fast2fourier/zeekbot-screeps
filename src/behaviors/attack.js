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
        var hostiles = catalog.hostiles[creep.pos.roomName];
        if(data.maxRange > 0){
            hostiles = _.filter(hostiles, hostile => creep.pos.getRangeTo(hostile) < data.maxRange);
        }
        var hostileStructures = catalog.hostileStructures[creep.pos.roomName];
        
        var targetFlag = Game.flags[_.get(Memory, 'targetFlag', _.get(data, 'flag', 'Base'))];
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
        if(target){
            var result = creep.attack(target);
            if(result == ERR_NOT_IN_RANGE) {
                creep.moveTo(target);
            }else if(result == OK){
                creep.say(sayings[Math.floor(Math.random()*sayings.length)]);
            }
        }
    }
};

module.exports = AttackBehavior;