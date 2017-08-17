"use strict";

const BaseWorker = require('./base');

const Util = require('../util');

const ignoreTypes = [STRUCTURE_WALL, STRUCTURE_RAMPART, STRUCTURE_CONTROLLER];

class AttackWorker extends BaseWorker {
    constructor(){ super('attack', { quota: true, critical: 'attack' }); }

    /// Job ///

    attack(cluster, subtype){
        var targets = [];
        for(var flag of Flag.getByPrefix('attack')){
            //TODO fix name ambiguities
            if(flag.name.includes(cluster.id)){
                targets.push(flag);
            }
        }
        return this.jobsForTargets(cluster, subtype, targets);
    }

    genTarget(cluster, subtype, id, args){
        return Game.flags[id];
    }

    createId(cluster, subtype, target, args){
        return target.name;
    }
	    
    calculateCapacity(cluster, subtype, id, target, args){
        if(target.parts.length > 2){
            return parseInt(target.parts[1]);
        }
        return 1;
    }

    /// Creep ///

    calculateBid(cluster, creep, opts, job, distance){
        return distance / 50;
    }

    process(cluster, creep, opts, job, flag){
        if(flag.room){
            var matrix = flag.room.matrix;
            var target = Util.closest(creep, matrix.hostiles);
            if(target){
                let dist = creep.pos.getRangeTo(target);
                target.room.visual.circle(target.pos, { radius: 0.5, opacity: 0.25 });
                target.room.visual.text('HP: '+target.hits, target.pos.x + 5, target.pos.y, { color: '#CCCCCC', background: '#000000' });
                if(dist < 3){
                    this.moveAway(creep, _.filter(matrix.armed, hostile => creep.pos.getRangeTo(hostile) <= 3), 6);
                }else if(dist > 3){
                    this.attackMove(creep, target);
                }
            }else{
                var buildings = _.filter(flag.room.find(FIND_HOSTILE_STRUCTURES), struct => !_.includes(ignoreTypes, struct.structureType));
                if(buildings.length > 0){
                    var target = Util.closest(creep, buildings);
                    console.log(target);
                    if(creep.pos.getRangeTo(target) > 3){
                        creep.moveTo(target);
                    }else{
                        creep.rangedAttack(target);
                    }
                }else{
                    var sites = _.filter(flag.room.find(FIND_HOSTILE_CONSTRUCTION_SITES), struct => !_.includes(ignoreTypes, struct.structureType));
                    if(sites.length > 0){
                        var target = Util.closest(creep, sites);
                        creep.moveTo(target);
                    }else if(creep.pos.getRangeTo(flag) > 1){
                        this.attackMove(creep, flag);
                    }
                }
            }
        }
    }

}

module.exports = AttackWorker;