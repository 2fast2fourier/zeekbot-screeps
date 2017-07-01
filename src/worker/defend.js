"use strict";

function defendRoom(result, room){
    var roomData = Game.matrix.rooms[room.name];
    if(roomData.hostiles.length > 0 && roomData.total.heal < 80 && roomData.total.ranged_attack < 300){
        result.push(roomData.hostiles);
    }
    return result;
}

const BaseWorker = require('./base');

class DefendWorker extends BaseWorker {
    constructor(){ super('defend', { quota: [ 'defend', 'rampart', 'longbow' ], critical: true }); }

    genTarget(cluster, subtype, id, args){
        if(subtype == 'rampart' || subtype == 'longbow'){
            return Game.flags[id];
        }else{
            return super.genTarget(cluster, subtype, id, args);
        }
    }

    createId(cluster, subtype, target, args){
        if(subtype == 'rampart' || subtype == 'longbow'){
            return target.name;
        }else{
            return super.createId(cluster, subtype, target, args);
        }
    }

    /// Job ///

    defend(cluster, subtype){
        let hostiles = _.reduce(cluster.rooms, defendRoom, []);
        return this.jobsForTargets(cluster, subtype, _.flatten(hostiles));
    }
    
    rampart(cluster, subtype){
        var ramparts = [];
        for(var flag of Flag.getByPrefix('Rampart')){
            if(flag.room && flag.room.cluster && flag.room.cluster.id == cluster.id){
                ramparts.push(this.createJob(cluster, subtype, flag));
            }
        }
        return ramparts;
    }
    
    longbow(cluster, subtype){
        var ramparts = [];
        for(var flag of Flag.getByPrefix('Longbow')){
            if(flag.room && flag.room.cluster && flag.room.cluster.id == cluster.id){
                ramparts.push(this.createJob(cluster, subtype, flag));
            }
        }
        return ramparts;
    }

    // calculateCapacity(cluster, subtype, id, target, args){
    //     if(subtype == 'rampart' || subtype == 'longbow'){
    //         return 1;
    //     }
    //     return 1;
    // }

    /// Creep ///

    calculateBid(cluster, creep, opts, job, distance){
        return distance / 50;
    }

    processRampart(cluster, creep, opts, job, flag){
        var flagRange = creep.pos.getRangeTo(flag);
        if(flagRange > 1){
            this.move(creep, flag);
        }else if(flagRange == 1){
            creep.moveTo(flag);
        }
    }

    process(cluster, creep, opts, job, target){
        if(job.subtype == 'rampart' || job.subtype == 'longbow'){
            return this.processRampart(cluster, creep, opts, job, target);
        }
        let attack = creep.getActiveBodyparts('attack');
        let ranged = creep.getActiveBodyparts('ranged_attack');
        let dist = creep.pos.getRangeTo(target);
        if(attack > 0){
            this.orMove(creep, target, creep.attack(target));
        }else if(ranged > 0){
            if(dist < 3){
                var result = PathFinder.search(creep.pos, { pos: target.pos, range: 3 }, { flee: true });
                creep.move(creep.pos.getDirectionTo(result.path[0]));
            }else if(dist > 3){
                this.move(creep, target);
            }
        }
        if(ranged > 0 && dist <= 3){
            creep.rangedAttack(target);
        }
    }

}

module.exports = DefendWorker;