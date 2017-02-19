"use strict";

const BaseWorker = require('./base');

class MineWorker extends BaseWorker {
    constructor(){ super('mine', { quota: ['energy', 'mineral'] }); }

    /// Job ///

    energy(cluster, subtype){
        var sources = cluster.findAll(FIND_SOURCES);
        return this.jobsForTargets(cluster, subtype, sources);
    }

    mineral(cluster, subtype){
        var minerals = _.filter(cluster.findAll(FIND_MINERALS), mineral => mineral.mineralAmount > 0 && mineral.hasExtractor());
        return this.jobsForTargets(cluster, subtype, minerals);
    }

    calculateCapacity(cluster, subtype, id, target, args){
        return 6;
    }

    /// Creep ///

    allocate(cluster, creep, opts){
        return creep.getActiveBodyparts('work');
    }

    calculateBid(cluster, creep, opts, job, distance){
        return distance / 50;
    }

    process(cluster, creep, opts, job, target){
        if(creep.getStored() >= creep.getCapacity() * 0.9){
            _.forEach(creep.getResourceList(), (amount, type)=>creep.drop(type, amount));
        }
        this.orMove(creep, target, creep.harvest(target));
    }

}

module.exports = MineWorker;