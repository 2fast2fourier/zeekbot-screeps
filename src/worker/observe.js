"use strict";

const BaseWorker = require('./base');

class ObserveWorker extends BaseWorker {
    constructor(){ super('observe', { quota: true }); }

    /// Job ///

    genTarget(cluster, subtype, id, args){
        if(id.indexOf('-') > 0){
            let parts = id.split('-');
            let pos = { pos: new RoomPosition(parseInt(parts[1]), parseInt(parts[2]), parts[0]), range: 15 };
            return _.get(Game.rooms, [parts[0], 'controller'], pos);
        }else{
            return Game.getObjectById(id);
        }
    }

    createId(cluster, subtype, target, args){
        if(target.id){
            return target.id;
        }else{
            return target.pos.roomName + '-' + target.pos.x + '-' +target.pos.y;
        }
    }

    observe(cluster, subtype){
        const targets = _.reduce(Memory.rooms, (result, data, name)=>{
            if(data.cluster == cluster.id && data.role != 'core'){
                let targetRoom = Game.rooms[name];
                let target;
                if(!targetRoom || !targetRoom.controller){
                    target = { pos: new RoomPosition(25, 25, name), range: 15 };
                }else{
                    target = targetRoom.controller;
                }
                result.push(target);
            }
            return result;
        }, []);
        return this.jobsForTargets(cluster, subtype, targets);
    }

    /// Creep ///

    calculateBid(cluster, creep, opts, job, distance){
        return distance / 50;
    }

    process(cluster, creep, opts, job, target){
        if(creep.pos.getRangeTo(target) > target.range || 1){
            this.move(creep, target);
        }
    }

}

module.exports = ObserveWorker;