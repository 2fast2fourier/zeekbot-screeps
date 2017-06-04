"use strict";

const BaseWorker = require('./base');

class DefendWorker extends BaseWorker {
    constructor(){ super('defend', { quota: true }); }

    /// Job ///

    defend(cluster, subtype){
        let hostiles = _.reduce(cluster.rooms, (result, room)=>{
            var roomData = Game.matrix.rooms[room.name];
            if(roomData.hostiles.length > 0){
                return result.concat(roomData.hostiles);
            }
            return result;
        }, []);
        return this.jobsForTargets(cluster, subtype, _.filter(hostiles, target => _.get(target, 'owner.username', false) != 'Source Keeper'));
    }

    calculateCapacity(cluster, subtype, id, target, args){
        var value = target.getActiveBodyparts(ATTACK) * 5;
        value += target.getActiveBodyparts(RANGED_ATTACK) * 3;
        value += target.getActiveBodyparts(WORK) * 2;
        value += target.getActiveBodyparts(HEAL) * 5;
        return Math.max(1, Math.ceil(value / 35));
    }

    /// Creep ///

    calculateBid(cluster, creep, opts, job, distance){
        return distance / 50;
    }

    process(cluster, creep, opts, job, target){
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