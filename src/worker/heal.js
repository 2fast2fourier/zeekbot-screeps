"use strict";

const BaseWorker = require('./base');

class HealWorker extends BaseWorker {
    constructor(){ super('heal', { quota: true, critical: 'heal' }); }

    /// Job ///

    heal(cluster, subtype){
        let healrooms = _.filter(cluster.rooms, room => room.memory.role != 'core' || _.get(room, 'controller.level', 0) < 3);
        let targets = _.filter(cluster.findIn(healrooms, FIND_MY_CREEPS), creep => creep.hits < creep.hitsMax);
        return this.jobsForTargets(cluster, subtype, targets);
    }

    jobValid(cluster, job){
        return super.jobValid(cluster, job) && job.target.hits < job.target.hitsMax;
    }

    /// Creep ///

    calculateBid(cluster, creep, opts, job, distance){
        return distance / 50;
    }

    process(cluster, creep, opts, job, target){
        let range = creep.pos.getRangeTo(target);
        if(range > 1){
            this.move(creep, target);
            if(range <= 3){
                creep.rangedHeal(target);
            }
        }else{
            creep.heal(target);
        }
    }

}

module.exports = HealWorker;