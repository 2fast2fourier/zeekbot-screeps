"use strict";

const BaseWorker = require('./base');

const Util = require('../util');

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

    process(cluster, creep, opts, job, flag){
        var matrix = Game.matrix.rooms[creep.room.name];
        var target = false;
        if(!target){
            target = _.first(_.sortBy(matrix.hostiles, target => creep.pos.getRangeTo(target)));
        }
        if(target){
            let dist = creep.pos.getRangeTo(target);
            target.room.visual.circle(target.pos, { radius: 0.5, opacity: 0.25 });
            target.room.visual.text('HP: '+target.hits, target.pos.x + 5, target.pos.y, { color: '#CCCCCC', background: '#000000' });
            if(dist < 3){
                var result = PathFinder.search(creep.pos, { pos: target.pos, range: 3 }, { flee: true });
                creep.move(creep.pos.getDirectionTo(result.path[0]));
            }else if(dist > 3){
                this.attackMove(creep, target);
            }
        }else if(creep.pos.getRangeTo(flag) > 3){
            this.attackMove(creep, flag);
        }else if(!flag.name.includes('stage')){
           flag.remove();
        }
    }

}

module.exports = AttackWorker;