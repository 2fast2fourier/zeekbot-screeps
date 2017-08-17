"use strict";

const BaseWorker = require('./base');

class DowngradeWorker extends BaseWorker {
    constructor(){ super('downgrade', { quota: true, minEnergy: 100000 }); }

    /// Job ///

    downgrade(cluster, subtype){
        var flags = _.filter(Flag.getByPrefix('Downgrade'), flag => flag.name.split('-')[1] == cluster.id && flag.room);
        _.forEach(flags, flag => {
            if(!_.get(flag, 'room.controller.owner.username') || _.get(flag, 'room.controller.my')){
                flag.remove();
            }
        });
        return this.jobsForTargets(cluster, subtype, flags.map(flag => flag.room.controller));
    }

    calculateCapacity(cluster, subtype, id, target, args){
        return 1;
    }

    jobValid(cluster, job){
        return super.jobValid(cluster, job) && _.get(job, 'target.owner.username', false) && !job.target.my;
    }

    /// Creep ///

    calculateBid(cluster, creep, opts, job, distance){
        return distance / 50;
    }

    process(cluster, creep, opts, job, target){
        this.orAttackMove(creep, target, creep.attackController(target));
    }

}

module.exports = DowngradeWorker;