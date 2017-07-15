"use strict";

const BaseWorker = require('./base');

const offsets = {
    spawn: -1,
    extension: -0.5,
    tower: -0.5,
    container: -0.25,
    lab: 1
}

class BuildWorker extends BaseWorker {
    constructor(){ super('build', { requiresEnergy: true, quota: true, range: 3, minEnergy: 500 }); }

    /// Job ///
    calculateCapacity(cluster, subtype, id, target, args){
        return  target.progressTotal - target.progress;
    }

    build(cluster, subtype){
        return this.jobsForTargets(cluster, subtype, cluster.findAll(FIND_MY_CONSTRUCTION_SITES));
    }

    /// Creep ///

    calculateBid(cluster, creep, opts, job, distance){
        return distance / 50 + (1 - job.target.progress / job.target.progressTotal) + (offsets[job.target.structureType] || 0);
    }

    allocate(cluster, creep, opts){
        return creep.getResource(RESOURCE_ENERGY);
    }

    process(cluster, creep, opts, job, target){
        this.orMove(creep, target, creep.build(target));
        if(target.structureType == 'rampart'){
            creep.memory.rampart = target.pos.str;
        }
    }

    end(cluster, creep, opts, job){
        if(creep.memory.rampart){
            var pos = RoomPosition.fromStr(creep.memory.rampart);
            var target = _.find(pos.lookFor(LOOK_STRUCTURES), { structureType: 'rampart' });
            delete creep.memory.rampart;
            if(target && target.hits < 10000){
                console.log(cluster.id, creep.name, 'Built rampart at', pos, 'repairing...');
                return {
                    target,
                    type: 'repair',
                    subtype: 'repair',
                    allocation: 1
                };
            }
        }
    }
}

module.exports = BuildWorker;