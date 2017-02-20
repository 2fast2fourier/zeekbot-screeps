"use strict";

const config = require('../creeps');

const workerCtors = {
    build: require('./build'),
    defend: require('./defend'),
    deliver: require('./deliver'),
    mine: require('./mine'),
    observe: require('./observe'),
    pickup: require('./pickup'),
    repair: require('./repair'),
    reserve: require('./reserve'),
    upgrade: require('./upgrade')
};

const Behavior = require('../behavior');

class Worker {
    static process(cluster){
        const workers = _.mapValues(workerCtors, ctor => new ctor());
        const behaviors = Behavior();
        const creeps = _.filter(cluster.creeps, 'ticksToLive');
        _.forEach(creeps, Worker.validate.bind(this, workers, behaviors, cluster));
        _.forEach(creeps, Worker.work.bind(this, workers, behaviors, cluster));

        if(Game.interval(20) || cluster.requestedQuota){
            Worker.generateQuota(workers, cluster);
        }
    }

    //hydrate, validate, and end jobs
    static validate(workers, behaviors, cluster, creep){
        if(creep.memory.lx == creep.pos.x && creep.memory.ly == creep.pos.y){
            creep.memory.sitting = Math.min( 256, creep.memory.sitting * 2);
        }else{
            creep.memory.sitting = 1;
        }
        creep.memory.lx = creep.pos.x;
        creep.memory.ly = creep.pos.y;

        var behave = _.get(config, [creep.memory.type, 'behavior'], false);
        if(behave){
            creep.blocked = _.reduce(behave, (result, opts, type)=>{
                behaviors[type].preWork(cluster, creep, opts);
                if(result){
                    return result;
                }
                return behaviors[type].shouldBlock(cluster, creep, opts);
            }, false);
        }

        let id = creep.memory.job;
        let type = creep.memory.jobType;
        if(id && type){
            const opts = _.get(config, [creep.memory.type, 'work', type], false);
            let work = workers[type];
            let job = work.hydrateJob(cluster, creep.memory.jobSubType, id, creep.memory.jobAllocation);
            let endJob = (job.killed && !work.keepDeadJob(cluster, creep, opts, job)) || !work.continueJob(cluster, creep, opts, job);
            if(endJob){
                // console.log('ending', type, creep.name, job.killed);
                work.end(cluster, creep, opts, job);
                creep.memory.job = false;
                creep.memory.jobType = false;
                creep.memory.jobSubType = false;
                creep.memory.jobAllocation = 0;
                creep.job = null;
            }else{
                creep.job = job;
            }
        }
    }

    //bid and work jobs
    static work(workers, behaviors, cluster, creep){
        const workConfig = config[creep.memory.type].work;
        if(!creep.memory.job){
            var lowestBid = Infinity;
            var bidder = _.reduce(workConfig, (result, opts, type) => {
                if(!workers[type]){
                    // console.log('missing worker', type);
                    return result;
                }
                var bid = workers[type].bid(cluster, creep, opts);
                if(bid !== false && bid.bid < lowestBid){
                    lowestBid = bid.bid;
                    return bid;
                }
                return result;
            }, false);

            if(bidder !== false){
                creep.memory.job = bidder.job.id;
                creep.memory.jobType = bidder.job.type;
                creep.memory.jobSubType = bidder.job.subtype;
                creep.memory.jobAllocation = bidder.allocation;
                workers[bidder.type].start(cluster, creep, workConfig[bidder.type], bidder.job);
                workers[bidder.type].registerAllocation(cluster, bidder.job, bidder.allocation);
                creep.job = bidder.job;
                // console.log('starting', bidder.job.type, creep.name, bidder.job.id);
            }
        }
        var behave = _.get(config, [creep.memory.type, 'behavior'], false);
        if(creep.blocked){
            behaviors[creep.blocked.type].blocked(cluster, creep, behave[creep.blocked.type], creep.blocked.data);
        }else{
            let action = false;
            if(creep.memory.job && creep.job){
                let job = creep.job;
                let type = job.type;
                action = workers[type].process(cluster, creep, workConfig[type], job, job.target);
            }
            _.forEach(behave, (opts, type) => behaviors[type].postWork(cluster, creep, opts, action));
        }

    }

    static generateQuota(workers, cluster){
        var quota = {};
        var assignments = {};
        let cores = cluster.getRoomsByRole('core');
        let harvest = cluster.getRoomsByRole('harvest');

        _.forEach(workers, worker => worker.calculateQuota(cluster, quota));

        assignments.spawn = _.zipObject(_.map(cores, 'name'), new Array(cores.length).fill(1));
        assignments.harvest = _.zipObject(_.map(harvest, 'name'), new Array(harvest.length).fill(2));

        quota.spawnhauler = _.sum(assignments.spawn) + 1;

        if(_.size(cluster.structures.storage) > 0){
            quota.harvesthauler = _.sum(assignments.harvest);
        }

        cluster.update('quota', quota);
        cluster.update('assignments', assignments);
    }
}

module.exports = Worker;