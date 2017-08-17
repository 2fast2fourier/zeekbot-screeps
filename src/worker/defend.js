"use strict";

const Util = require('../util');

const BaseWorker = require('./base');

class DefendWorker extends BaseWorker {
    constructor(){ super('defend', { quota: [ 'defend', 'rampart', 'longbow', 'heavy' ], critical: true }); }

    genTarget(cluster, subtype, id, args){
        if(subtype == 'defend' || subtype == 'heavy'){
            return { id, pos: new RoomPosition(25, 25, id) };
        }
        var target = _.get(cluster.defense, [subtype, id]);
        return target ? { id, pos: new RoomPosition(target.pos.x, target.pos.y, target.pos.roomName) } : undefined;
    }

    generateJobsForSubtype(cluster, subtype){
        if(subtype == 'defend' || subtype == 'heavy'){
            var defendRooms = _.filter(cluster.roomflags.defend, room => room.matrix.hostiles.length > 0
                && ((room.matrix.total.heal < 80 && subtype == 'defend') || (room.matrix.total.heal > 0 && room.matrix.total.heal < 800 && subtype == 'heavy')));
            return _.map(defendRooms, room => this.createJob(cluster, subtype, { id: room.name, pos: new RoomPosition(25, 25, room.name)}));
        }
        return this.jobsForTargets(cluster, subtype, _.map(cluster.defense[subtype], target => {
            return {
                id: target.id,
                pos: new RoomPosition(target.pos.x, target.pos.y, target.pos.roomName)
            };
        }));
    }

    /// Creep ///
    
    continueJob(cluster, creep, opts, job){
        if(job.subtype == 'defend' || job.subtype == 'heavy'){
            var room = Game.rooms[job.id];
            return !room || room.matrix.hostiles.length > 0;
        }else{
            return super.continueJob(cluster, creep, opts, job);
        }
    }

    calculateBid(cluster, creep, opts, job, distance){
        return distance / 50;
    }

    processRampart(cluster, creep, opts, job, target){
        var targetRange = creep.pos.getRangeTo(target.pos);
        if(targetRange > 1){
            this.move(creep, target);
        }else if(targetRange == 1){
            creep.moveTo(target);
        }
        var color = job.subtype == 'longbow' ? '#0000ff' : '#ff0000';
        var remaining = cluster.state.defcon - Game.time;
        var tickMessage = (remaining > 0 ? '' + remaining : 'EXP');
        new RoomVisual(target.pos.roomName)
            .circle(target.pos, { radius: 0.5, fill: color })
            .text(tickMessage, target.pos.x, target.pos.y + 1);
    }

    process(cluster, creep, opts, job, target){
        if(job.subtype != 'defend' && job.subtype != 'heavy'){
            return this.processRampart(cluster, creep, opts, job, target);
        }
        if(creep.room.name == target.pos.roomName){
            var nearest = Util.closest(creep, creep.room.matrix.hostiles);
            if(nearest){
                let distance = creep.pos.getRangeTo(nearest);
                let targetRange = job.subtype == 'heavy' ? 1 : 3;
                if(distance > targetRange){
                    this.move(creep, nearest);
                }else if(distance < targetRange){
                    this.moveAway(creep, nearest, targetRange + 3);
                }
                if(distance == 1){
                    creep.rangedMassAttack();
                }else if(distance <= 3){
                    creep.rangedAttack(nearest);
                }
            }
        }else if(creep.pos.getRangeTo(target) > 10){
            this.move(creep, target);
        }
    }

}

module.exports = DefendWorker;