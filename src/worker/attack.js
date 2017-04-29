"use strict";

const priorities = {
    tower: 0.01,
    spawn: 0.1,
    storage: 2,
    rampart: 10
};

const BaseWorker = require('./base');

const Util = require('../util');

class AttackWorker extends BaseWorker {
    constructor(){ super('attack', { quota: true, critical: 'attack' }); }

    /// Job ///

    attack(cluster, subtype){
        if(cluster.attackSource){
            return this.jobsForTargets(cluster, subtype, Flag.getByPrefix('attack'));
        }
        return [];
    }

    calculateCapacity(cluster, subtype, id, target, args){
        var parts = target.name.split('-');
        if(parts.length > 1){
            return parseInt(parts[1]);
        }
        return 1;
    }

    genTarget(cluster, subtype, id, args){
        return Game.flags[id];
    }

    createId(cluster, subtype, target, args){
        return target.name;
    }

    /// Creep ///

    calculateBid(cluster, creep, opts, job, distance){
        return distance / 50;
    }

    calculatePriority(creep, target){
        return creep.pos.getRangeTo(target) * _.get(priorities, target.structureType, 1);
    }

    process(cluster, creep, opts, job, flag){
        var action = false;
        var target = false;
        var inTargetRoom = creep.pos.roomName == flag.pos.roomName;
        if(inTargetRoom && flag.room){
            var flags = flag.room.getFlagsByPrefix('target');
            if(flags.length > 0){
                var targets = _.reduce(flags, (result, targetFlag) => {
                    var struct = targetFlag.getStructure();
                    if(struct){
                        result.push(struct);
                    }else{
                        targetFlag.remove();
                    }
                    return result;
                }, []);
                target = _.first(Util.sort.closest(creep, targets));
            }
        }
        if(!target){
            var buildings = inTargetRoom ? _.filter(cluster.find(creep.room, FIND_HOSTILE_STRUCTURES), target => _.get(target, 'owner.username', false) != 'Power Bank') : [];
            let hostiles = _.filter(cluster.find(creep.room, FIND_HOSTILE_CREEPS), target => _.get(target, 'owner.username', false) != 'Source Keeper');
            let targets = hostiles.concat(_.filter(buildings, target => _.get(target, 'owner.username', false) != 'Source Keeper' && target.structureType != STRUCTURE_CONTROLLER));
            target = _.first(_.sortBy(targets, target => this.calculatePriority(creep, target)));
        }
        if(target){
            let attack = creep.getActiveBodyparts('attack');
            let ranged = creep.getActiveBodyparts('ranged_attack');
            let dist = creep.pos.getRangeTo(target);
            target.room.visual.circle(target.pos, { radius: 0.5, opacity: 0.25 });
            if(attack > 0){
                action = this.orAttackMove(creep, target, creep.attack(target)) == OK;
            }else if(ranged > 0){
                if(dist < 3){
                    var result = PathFinder.search(creep.pos, { pos: target.pos, range: 3 }, { flee: true });
                    creep.move(creep.pos.getDirectionTo(result.path[0]));
                }else if(dist > 3){
                    this.attackMove(creep, target);
                }
            }
            if(ranged > 0 && dist <= 3){
                action = action || creep.rangedAttack(target) == OK;
            }
        }else if(creep.pos.getRangeTo(flag) > 3){
            this.attackMove(creep, flag);
        }else if(!flag.name.includes('stage')){
           flag.remove();
        }
        return action;
    }

}

module.exports = AttackWorker;