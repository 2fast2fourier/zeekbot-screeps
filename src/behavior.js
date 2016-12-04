"use strict";

var RoomUtil = require('./roomutil');
var behaviors = require('./behaviors');

class Behavior {

    static process(catalog){
        _.forEach(Game.creeps, creep => Behavior.processCreep(creep, catalog));
    }

    static idle(creep, targetGameTime){
        creep.memory.action = 'idle';
        creep.memory.traits.idle = targetGameTime;
    }

    static processCreep(creep, catalog){
        if(creep.memory.action && !behaviors[creep.memory.action].stillValid(creep, creep.memory.behaviors[creep.memory.action], catalog)){
            if(!behaviors[creep.memory.action].end){
                console.log('missing end method', creep.memory.action, creep.name);
                return;
            }

            //DEBUG
            if(Memory.debugType == creep.memory.type) console.log(creep, 'ending', creep.memory.action);

            behaviors[creep.memory.action].end(creep, creep.memory.behaviors[creep.memory.action], catalog);
            catalog.removeTrait(creep, creep.memory.action);
            creep.memory.action = false;
        }
        if(!creep.memory.action){
            var lowestBid = false;
            var lowestBidder = false;
            _.forEach(creep.memory.behaviors, (data, name) =>{
                if(!behaviors[name] || !behaviors[name].bid){
                    console.log(name, creep.name, data[name]);
                    return;
                }
                var bid = behaviors[name].bid(creep, data, catalog);
                if(bid === false){
                    return;
                }
                //DEBUG
                if(Memory.debugType == creep.memory.type) console.log(creep, bid, name, data, lowestBid, lowestBidder);
                if(lowestBid === false || bid < lowestBid){
                    lowestBid = bid;
                    lowestBidder = name;
                }
            });
            if(lowestBid !== false){
                var started = behaviors[lowestBidder].start(creep, creep.memory.behaviors[lowestBidder], catalog);
                //DEBUG
                if(Memory.debugType == creep.memory.type) console.log(creep, 'starting', lowestBidder, lowestBid, started, creep.memory.traits[lowestBidder]);
                if(started){
                    creep.memory.action = lowestBidder;
                    catalog.addTrait(creep, lowestBidder, creep.memory.traits[lowestBidder]);
                }else{
                    //DEBUG
                    if(Memory.debugType == creep.memory.type) console.log("Failed to start!", creep, lowestBidder);
                    behaviors[lowestBidder].end(creep, creep.memory.behaviors[lowestBidder], catalog);
                    catalog.removeTrait(creep, lowestBidder);
                }
            }
        }
        if(creep.memory.action === 'idle'){
            if(Game.time >= _.get(creep.memory, 'traits.idle')){
                creep.memory.action = false;
                creep.memory.traits.idle = false;
            }
        }else if(creep.memory.action){
            behaviors[creep.memory.action].process(creep, creep.memory.behaviors[creep.memory.action], catalog);
        }
    }

}

module.exports = Behavior;