"use strict";

var RoomUtil = require('../roomutil');
var { BaseFlagBehavior } = require('./base');

class ReserveBehavior extends BaseFlagBehavior {

    process(creep, data, catalog){
        var claimFlag = Game.flags[data.flag];
        if(claimFlag){
            if(creep.pos.roomName != claimFlag.pos.roomName){
                creep.moveTo(claimFlag);
            }else{
                var result = creep.reserveController(creep.room.controller);
                if(result == ERR_NOT_IN_RANGE){
                    creep.moveTo(creep.room.controller);
                }
            }
        }
    }
};

class ClaimBehavior extends BaseFlagBehavior {

    process(creep, data, catalog){
        var claimFlag = Game.flags[data.flag];
        if(claimFlag){
            if(creep.pos.roomName != claimFlag.pos.roomName){
                creep.moveTo(claimFlag);
            }else{
                var result = creep.claimController(creep.room.controller);
                if(result == ERR_NOT_IN_RANGE){
                    creep.moveTo(creep.room.controller);
                }else if(result == OK){
                    console.log("Claimed room", creep.pos.roomName);
                    claimFlag.remove();
                }
            }
        }
    }
};

module.exports = {
    ClaimBehavior,
    ReserveBehavior
}