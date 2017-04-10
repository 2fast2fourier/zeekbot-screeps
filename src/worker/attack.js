"use strict";

const BaseWorker = require('./base');

class AttackWorker extends BaseWorker {
    constructor(){ super('attack', { quota: true }); }

    /// Job ///

    defend(cluster, subtype){
        let hostiles = cluster.findAll(FIND_HOSTILE_CREEPS);
        let buildings = cluster.findAll(FIND_HOSTILE_STRUCTURES);
        let targets = hostiles.concat(_.filter(buildings, target => _.get(target, 'owner.username', false) != 'Source Keeper'));
        
        return this.jobsForTargets(cluster, subtype, targets);
    }

    calculateCapacity(cluster, subtype, id, target, args){
        return 1;
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

module.exports = AttackWorker;