"use strict";

const BaseWorker = require('./base');

class IdleWorker extends BaseWorker {
    constructor(){ super('idle', { priority: 99, critical: true }); }

    genTarget(cluster, subtype, id, args){
        if(subtype == 'gather'){
            return { id: id, pos: RoomPosition.fromStr(id) };
        }else{
            return super.genTarget(cluster, subtype, id, args);
        }
    }

    createId(cluster, subtype, target, args){
        if(subtype == 'gather'){
            return target.pos.str;
        }else{
            return super.createId(cluster, subtype, target, args);
        }
    }

    /// Job ///
    calculateCapacity(cluster, subtype, id, target, args){
        return 8;
    }

    generateJobsForSubtype(cluster, subtype){
        if(subtype == 'gather'){
            var points = _.map(cluster.getGatherPoints(), point => {
                return { id: point.str, pos: point };
            });
            return this.jobsForTargets(cluster, subtype, points);
        }
        return this.jobsForTargets(cluster, subtype, cluster.structures[subtype]);
    }

    /// Creep ///

    continueJob(cluster, creep, opts, job){
        return super.continueJob(cluster, creep, opts, job) && !Game.interval(10);
    }

    calculateBid(cluster, creep, opts, job, distance){
        return distance / 50;
    }

    process(cluster, creep, opts, job, target){
        if(creep.pos.getRangeTo(target) > 2){
            this.move(creep, target);
        }
    }

}

module.exports = IdleWorker;