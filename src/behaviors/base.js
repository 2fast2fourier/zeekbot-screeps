"use strict";

var RoomUtil = require('../roomutil');

class BaseBehavior {
    constructor(type){
        this.type = type;
    }

    stillValid(creep, data, catalog){ return creep.memory.traits[this.type] && !!this.target(creep); }
    bid(creep, data, catalog){ return false; }
    start(creep, data, catalog){ return false; }
    process(creep, data, catalog){ }

    end(creep, data, catalog){
        delete creep.memory.traits[this.type];
    }

    target(creep){
        return Game.getObjectById(creep.memory.traits[this.type]);
    }

    trait(creep){
        return creep.memory.traits[this.type];
    }

    exists(creep){
        return !!this.target(creep);
    }

    setTrait(creep, trait){
        if(trait === false){
            delete creep.memory.traits[this.type];
        }else{
            creep.memory.traits[this.type] = trait;
        }
    }

    setup(memory, data, catalog, room){ }
}

class RemoteBaseBehavior extends BaseBehavior {
    constructor(type){ super(type); }

    getFlag(creep, data){
        if(data.flag === true){
            return Game.flags[creep.memory.flag];
        }
        return Game.flags[data.flag];
    }

    stillValid(creep, data, catalog){
        var flag = this.getFlag(creep, data);
        if(flag && (creep.pos.roomName != flag.pos.roomName || RoomUtil.onEdge(creep.pos))){
            return true;
        }
        if(flag && data.approachFlag && creep.pos.getRangeTo(flag) >= data.maxRange){
            return true;
        }
        return false;
    }
    bid(creep, data, catalog){
        var flag = this.getFlag(creep, data);
        if(flag && creep.pos.roomName == flag.pos.roomName && data.approachFlag && creep.pos.getRangeTo(flag) >= data.maxRange){
            return true;
        }
        return flag && creep.pos.roomName != flag.pos.roomName;
    }
    start(creep, data, catalog){
        var flag = this.getFlag(creep, data);
        if(flag && creep.pos.roomName == flag.pos.roomName && data.approachFlag && creep.pos.getRangeTo(flag) >= data.maxRange){
            return true;
        }
        return flag && creep.pos.roomName != flag.pos.roomName;
    }
    process(creep, data, catalog){
        var flag = this.getFlag(creep, data);
        if(flag && (creep.pos.roomName != flag.pos.roomName || RoomUtil.onEdge(creep.pos))){
            creep.moveTo(flag);
            return true;
        }
        if(flag && data.approachFlag && creep.pos.getRangeTo(flag) >= data.maxRange){
            creep.moveTo(flag);
            return true;
        }
        return false;
    }
}

class BaseFlagBehavior extends RemoteBaseBehavior {

    stillValid(creep, data, catalog){
        return !!this.getFlag(creep, data);
    }

    bid(creep, data, catalog){
        return !!this.getFlag(creep, data);
    }

    start(creep, data, catalog){
        return !!this.getFlag(creep, data);
    }

    process(creep, data, catalog){ }

    end(creep, data, catalog){ }

    setup(memory, data, catalog, room){ }
};

module.exports = {
    BaseBehavior,
    RemoteBaseBehavior,
    BaseFlagBehavior
};