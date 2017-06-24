"use strict";

const BaseWorker = require('./base');

class MineWorker extends BaseWorker {
    constructor(){ super('mine', { quota: ['energy', 'mineral'], critical: 'energy' }); }

    /// Job ///

    energy(cluster, subtype){
        var sources = _.filter(cluster.findAll(FIND_SOURCES), source => source.room.memory.role != 'reserve');
        return this.jobsForTargets(cluster, subtype, sources);
    }

    mineral(cluster, subtype){
        var resources = Game.federation.resources;
        var minerals = _.filter(cluster.findAll(FIND_MINERALS), mineral => mineral.mineralAmount > 0 && resources[mineral.mineralType].stored < 250000 && mineral.hasExtractor());
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

    start(cluster, creep, opts, job){
        creep.memory.mining = creep.getActiveBodyparts('work') * 2;
    }

    process(cluster, creep, opts, job, target){
        if(creep.pos.getRangeTo(target) > 1){
            this.move(creep, target);
        }else{
            creep.harvest(target);
        }
        // else if(creep.harvest(target) == OK && job.subtype == 'energy'){
        //     cluster.longtermAdd('mine', Math.min(target.energy, creep.memory.mining));
        // }
    }

}

module.exports = MineWorker;