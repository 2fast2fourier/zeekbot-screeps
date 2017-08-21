"use strict";

const BaseWorker = require('./base');

class HealWorker extends BaseWorker {
    constructor(){ super('heal', { quota: true, critical: 'heal' }); }

    /// Job ///

    heal(cluster, subtype){
        let creeps = _.flatten(_.map(cluster.roles.keep.concat(cluster.roles.harvest), 'matrix.damaged'));
        return this.jobsForTargets(cluster, subtype, _.filter(creeps, creep => creep.getActiveBodyparts('heal') == 0));
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