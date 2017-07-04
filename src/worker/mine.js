"use strict";

const BaseWorker = require('./base');

class MineWorker extends BaseWorker {
    constructor(){ super('mine', { quota: ['energy', 'mineral'], critical: 'energy' }); }

    /// Job ///

    energy(cluster, subtype){
        if(!cluster.cache.sources || cluster.cache.sourceUpdate < Game.time){
            var sources = _.filter(cluster.findAll(FIND_SOURCES), source => source.room.memory.role != 'reserve');
            cluster.cache.sources = _.map(sources, 'id');
            cluster.cache.sourceUpdate = Game.time + 500;
        }
        return this.jobsForTargets(cluster, subtype, _.compact(Game.getObjects(cluster.cache.sources)));
    }

    mineral(cluster, subtype){
        if(!cluster.cache.extractors || cluster.cache.extractorUpdate < Game.time){
            var resources = Game.federation.resources;
            var sources = _.filter(cluster.findAll(FIND_MINERALS), mineral => mineral.mineralAmount > 0 && resources[mineral.mineralType].stored < 250000 && mineral.hasExtractor());
            cluster.cache.extractors = _.map(sources, 'id');
            cluster.cache.extractorUpdate = Game.time + 500;
        }
        var minerals = _.filter(Game.getObjects(cluster.cache.extractors), mineral => mineral && mineral.mineralAmount > 0);
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