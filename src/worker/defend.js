"use strict";

function defendRoom(result, room){
    var roomData = Game.matrix.rooms[room.name];
    if(roomData.hostiles.length > 0 && roomData.total.heal < 80 && roomData.total.ranged_attack < 300){
        result.push(roomData.hostiles);
    }
    return result;
}

function heavyDefendRoom(result, room){
    var roomData = Game.matrix.rooms[room.name];
    if(roomData.hostiles.length > 0 && roomData.total.heal >= 80 && roomData.total.heal <= 340){
        result.push(roomData.hostiles);
    }
    return result;
}

const defendFn = {
    defend: defendRoom,
    heavy: heavyDefendRoom
}

const BaseWorker = require('./base');

class DefendWorker extends BaseWorker {
    constructor(){ super('defend', { quota: [ 'defend', 'rampart', 'longbow', 'heavy' ], critical: true }); }

    genTarget(cluster, subtype, id, args){
        if(subtype == 'defend' || subtype == 'heavy'){
            return super.genTarget(cluster, subtype, id, args);
        }
        var target = _.get(cluster.defense, [subtype, id]);
        return target ? { id, pos: new RoomPosition(target.pos.x, target.pos.y, target.pos.roomName) } : undefined;
    }

    generateJobsForSubtype(cluster, subtype){
        if(subtype == 'defend' || subtype == 'heavy'){
            return this.jobsForTargets(cluster, subtype, _.flatten(_.reduce(cluster.rooms, defendFn[subtype], [])));
        }
        return this.jobsForTargets(cluster, subtype, _.map(cluster.defense[subtype], target => {
            return {
                id: target.id,
                pos: new RoomPosition(target.pos.x, target.pos.y, target.pos.roomName)
            };
        }));
    }

    /// Creep ///

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
        let attack = creep.getActiveBodyparts('attack');
        let ranged = creep.getActiveBodyparts('ranged_attack');
        let dist = creep.pos.getRangeTo(target);
        if(attack > 0){
            this.orMove(creep, target, creep.attack(target));
        }else if(job.subtype == 'heavy'){
            this.move(creep, target);
        }else{
            if(dist < 3){
                //TODO better flee
                var result = PathFinder.search(creep.pos, { pos: target.pos, range: 3 }, { flee: true });
                creep.move(creep.pos.getDirectionTo(result.path[0]));
            }else if(dist > 3){
                this.move(creep, target);
            }
        }
        if(ranged > 0){
            if(dist == 1){
                creep.rangedMassAttack();
            }else if(dist > 1 && dist <= 3){
                creep.rangedAttack(target);
            }
        }
    }

}

module.exports = DefendWorker;