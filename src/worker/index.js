"use strict";

const config = require('../creeps');

const workerCtors = {
    build: require('./build'),
    deliver: require('./deliver'),
    mine: require('./mine'),
    pickup: require('./pickup'),
    upgrade: require('./upgrade')
};

class Worker {
    static process(cluster){
        const workers = _.mapValues(workerCtors, ctor => new ctor());
        const creeps = _.filter(cluster.creeps, 'ticksToLive');
        _.forEach(creeps, Worker.validate.bind(this, workers, cluster));
        _.forEach(creeps, Worker.work.bind(this, workers, cluster));

        if(Game.interval(20) || cluster.requestedQuota){
            Worker.generateQuota(workers, cluster);
        }
    }

    //hydrate, validate, and end jobs
    static validate(workers, cluster, creep){
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
    static work(workers, cluster, creep){
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
        
        if(creep.memory.job && creep.job){
            let job = creep.job;
            let type = job.type;
            let result = workers[type].process(cluster, creep, workConfig[type], job, job.target);
        }

    }

    static generateQuota(workers, cluster){
        var quota = {};
        _.forEach(workers, worker => worker.calculateQuota(cluster, quota));
        quota.spawnhauler = 1;
        cluster.updateQuota(quota);
    }
}

module.exports = Worker;