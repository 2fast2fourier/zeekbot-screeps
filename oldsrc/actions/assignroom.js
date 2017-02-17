"use strict";

var BaseAction = require('./base');

class AssignRoomAction extends BaseAction {
    constructor(catalog){
        super(catalog, 'assignRoom');
    }

    preWork(creep, opts){
        var type = creep.memory.actions.assignRoom.type;
        var assignments = this.generateAssignedList(type);
        var least = Infinity;
        var targetRoom = false;
        _.forEach(Memory.roomlist[type], (target, roomName) => {
            var assigned = _.get(assignments, roomName, 0) / target;
            if(assigned < least){
                least = assigned;
                targetRoom = roomName;
            }
        });
        if(targetRoom){
            creep.memory.room = targetRoom;
            creep.memory.roomtype = type;
            console.log('Assigned', creep.name, 'to room', targetRoom, creep.memory.roomtype, least);
        }
        delete creep.memory.actions.assignRoom;
    }

    generateAssignedList(type){
        return _.reduce(Game.creeps, (result, creep)=>{
            if(creep.memory.room && creep.memory.roomtype == type){
                _.set(result, creep.memory.room, _.get(result, creep.memory.room, 0) + (creep.ticksToLive / 1500));
            }
            return result;
        }, {});
    }
}


module.exports = AssignRoomAction;