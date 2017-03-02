"use strict";

const BaseWorker = require('./base');

class ObserveWorker extends BaseWorker {
    constructor(){ super('observe', { quota: true, critical: 'observe' }); }

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
        return target.pos.roomName + '-' + target.pos.x + '-' +target.pos.y;
    }

    observe(cluster, subtype){
        const targets = _.reduce(Memory.rooms, (result, data, name)=>{
            if(data.cluster == cluster.id && data.observe){
                let targetRoom = Game.rooms[name];
                if(targetRoom && targetRoom.controller && targetRoom.controller.my){
                    delete Memory.rooms[name].observe;
                }
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

    continueJob(cluster, creep, opts, job){
        if(opts.onlyReveal && Game.rooms[job.target.pos.roomName]){
            return false;
        }
        return super.continueJob(cluster, creep, opts, job) && (!opts.onlyReveal || !job.target.id);
    }

    calculateBid(cluster, creep, opts, job, distance){
        if(opts.onlyReveal && Game.rooms[job.target.pos.roomName]){
            return false;
        }
        return distance / 50;
    }

    process(cluster, creep, opts, job, target){
        if(creep.pos.getRangeTo(target) > (target.range || 1)){
            this.move(creep, target);
        }
    }

}

module.exports = ObserveWorker;