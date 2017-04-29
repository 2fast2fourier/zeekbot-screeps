"use strict";

const BaseWorker = require('./base');

class DismantleWorker extends BaseWorker {
    constructor(){ super('dismantle', { quota: true }); }

    /// Job ///
    calculateCapacity(cluster, subtype, id, target, args){
        return target.hits;
    }

    dismantle(cluster, subtype){
        var flags = Flag.getByPrefix("Dismantle");
        var type = false;
        var targets = [];
        for(let flag of flags){
            let roomName = flag.pos.roomName;
            let parts = flag.name.split('-');
            if(flag.room && (_.get(Memory.rooms, [roomName, 'cluster']) == cluster.id || parts[2] == cluster.id)){
                let parts = flag.name.split('-');
                let range = 0;
                if(parts.length > 1){
                    if(CONTROLLER_STRUCTURES[parts[1]]){
                        range = 50;
                        type = parts[1];
                    }else if(parts[1] == 'all'){
                        range = 50;
                    }else{
                        range = parseInt(parts[1]);
                    }
                }
                let structures = _.filter(flag.pos.findInRange(FIND_STRUCTURES, range), structure => _.get(structure, 'hits', 0) > 0 && (!type || structure.structureType == type));
                if(structures.length > 0){
                    targets = targets.concat(structures);
                }else{
                    flag.remove();
                }
            }
        }
        return this.jobsForTargets(cluster, subtype, targets);
    }

    /// Creep ///

    allocate(cluster, creep, opts){
        return creep.getActiveBodyparts('work') * 50000;
    }

    calculateBid(cluster, creep, opts, job, distance){
        return distance / 50;
    }

    process(cluster, creep, opts, job, target){
        this.orAttackMove(creep, target, creep.dismantle(target));
    }

}

module.exports = DismantleWorker;