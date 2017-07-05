"use strict";

const BaseWorker = require('./base');
const Squad = require('../squad');

class SquadWorker extends BaseWorker {
    constructor(){ super('squad', { quota: ['heal', 'attack', 'ranged', 'dismantle'], ignoreDistance: true }); }

    /// Job ///

    genTarget(cluster, subtype, id, args){
        return {
            id,
            squad: Squad.getSquad(id)
        };
    }

    calculateCapacity(cluster, subtype, id, target, args){
        return _.get(Squad.getSquad(id), ['spawn', cluster.id, subtype], 0);
    }

    generateJobsForSubtype(cluster, subtype){
        var squads = _.pick(Squad.getRecruitingSquads(), squad => _.get(squad, ['spawn', cluster.id, subtype], 0) > 0);
        var jobs = _.map(squads, (squad, id) => {
            return {
                capacity: _.get(squad, ['spawn', cluster.id, subtype], 0),
                allocation: 0,
                id,
                type: 'squad',
                subtype,
                target: {
                    id,
                    squad
                }
            };
        });
        return this.jobsForTargets(cluster, subtype, jobs);
    }

    jobValid(cluster, job){
        return Squad.isValid(job.id);
    }

    calculateQuota(cluster, quota){
        super.calculateQuota(cluster, quota);
        Squad.updateQuotaAllocations(cluster);
    }

    /// Creep ///

    continueJob(cluster, creep, opts, job){
        return Squad.isValid(job.id);
    }

    canBid(cluster, creep, opts){
        if(creep.ticksToLive < 1000){
            creep.suicide();
            console.log('Creep too old for new assignment.', creep.name, creep.ticksToLive);
            return false;
        }
        return true;
    }

    calculateBid(cluster, creep, opts, job, distance){
        return Squad.isRecruiting(job.id) ? 0 : false;
    }

    start(cluster, creep, opts, job){
        console.log(creep.name, 'Joined wave:', job.id);
    }

    process(cluster, creep, opts, job, target){
        Squad.registerCreep(job.id, creep);
        // work is done in squad processing
    }

    end(cluster, creep, opts, job){
        console.log('Wave ended:', job.id, 'Released:', creep.name);
        if(creep.ticksToLive < 1000){
            console.log('Ending unit:', creep.name);
            creep.suicide();
        }
    }

}

module.exports = SquadWorker;