"use strict";

const BaseWorker = require('./base');

class ObserveWorker extends BaseWorker {
    constructor(){ super('observe', { quota: true, critical: 'observe', ignoreRoads: true }); }

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
        return target.pos.roomName + '-25-25';
    }

    observe(cluster, subtype){
        let unobservedRooms = _.pick(Memory.observe || {}, timeout => timeout > Game.time);
        let flags = Flag.getByPrefix("Observe");
        for(let flag of flags){
            unobservedRooms[flag.pos.roomName] = Game.time + 25;
        }
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
                if(!targetRoom && !unobservedRooms[name]){
                    unobservedRooms[name] = Game.time + 200;
                }
                result.push(target);
            }
            return result;
        }, []);
        Memory.observe = unobservedRooms;
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
        if(creep.pos.getRangeTo(target) > (target.range || 3)){
            this.move(creep, target);
        }
    }

}

module.exports = ObserveWorker;