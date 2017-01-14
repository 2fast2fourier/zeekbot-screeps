"use strict";

var BaseAction = require('./base');

class AssignRoomAction extends BaseAction {
    constructor(catalog){
        super(catalog, 'assignRoom');
    }

    preWork(creep, opts){
        var assignments = this.generateAssignedList(creep.memory.type);
        var least = Infinity;
        var targetRoom = false;
        _.forEach(this.catalog.rooms, room => {
            var assigned = _.get(assignments, room.name, 0);
            if(assigned < least){
                least = assigned;
                targetRoom = room.name;
            }
        });
        if(targetRoom){
            creep.memory.room = targetRoom;
            console.log('assigned', creep.name, 'to room', targetRoom, least);
        }
        delete creep.memory.actions.assignRoom;
    }

    generateAssignedList(type){
        return _.reduce(Game.creeps, (result, creep)=>{
            if(creep.memory.type == type && creep.memory.room){
                _.set(result, creep.memory.room, _.get(result, creep.memory.room, 0) + (creep.ticksToLive / 1500));
            }
            return result;
        }, {});
    }
}


module.exports = AssignRoomAction;