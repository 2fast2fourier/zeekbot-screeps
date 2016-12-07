"use strict";

var RoomUtil = require('../roomutil');
var { BaseBehavior } = require('./base');

class HealBehavior extends BaseBehavior {

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
        var patients = _.filter(catalog.getCreeps(creep.room), patient => patient.hits < patient.hitsMax);
        var targetFlag = Game.flags[_.get(Memory, 'targetFlag', _.get(data, 'flag', 'Base'))];
        if(!targetFlag){
            targetFlag = Game.flags['Base'];
        }
        var target = false;
        if(targetFlag && (creep.pos.roomName != targetFlag.pos.roomName || (patients.length < 1))){
            if(creep.pos.getRangeTo(targetFlag) > 1){
                creep.moveTo(targetFlag);
            }
        }else if(patients.length > 0){
            var targets = _.sortBy(patients, (target)=>creep.pos.getRangeTo(target));
            target = targets[0];
        }
        if(target){
            var result = creep.heal(target);
            if(result == ERR_NOT_IN_RANGE) {
                creep.moveTo(target);
            }else if(result == OK){
                creep.say('beyoop');
            }
        }
    }
};

module.exports = HealBehavior;