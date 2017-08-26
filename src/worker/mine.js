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
            var max = Game.federation.structures.storage.length * 10000 + Game.federation.structures.terminal.length * 5000;
            var resources = Game.federation.resources;
            var minerals = _.filter(cluster.findAll(FIND_MINERALS), mineral => mineral.hasExtractor());
            var sources = _.filter(minerals, mineral => mineral.mineralAmount > 0 && resources[mineral.mineralType].stored < max);
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
        }else if(target.energy > 0){
            creep.harvest(target);
        }else if(target.mineralAmount > 0 && Game.interval(6)){
            creep.harvest(target);
        }
    }

}

module.exports = MineWorker;