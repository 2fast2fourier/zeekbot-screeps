"use strict";

const config = require('../creeps');
const Behavior = require('../behavior');

const workerCtors = {
    attack: require('./attack'),
    build: require('./build'),
    defend: require('./defend'),
    deliver: require('./deliver'),
    dismantle: require('./dismantle'),
    downgrade: require('./downgrade'),
    heal: require('./heal'),
    idle: require('./idle'),
    keep: require('./keep'),
    mine: require('./mine'),
    observe: require('./observe'),
    pickup: require('./pickup'),
    repair: require('./repair'),
    reserve: require('./reserve'),
    squad: require('./squad'),
    transfer: require('./transfer'),
    upgrade: require('./upgrade')
};

const workers = _.mapValues(workerCtors, ctor => new ctor());
const behaviors = Behavior();

class Worker {

    static process(cluster){

        _.forEach(workers, worker => worker.pretick(cluster));
        const creeps = _.filter(cluster.creeps, 'ticksToLive');
        _.forEach(creeps, Worker.validate.bind(this, cluster));

        if(Game.intervalOffset(20, 9)){
            Worker.generateQuota(cluster);
        }
    }

    //hydrate, validate, and end jobs
    static validate(cluster, creep){
        let cfg = config[creep.memory.type] || {};
        if(creep.memory.lx == creep.pos.x && creep.memory.ly == creep.pos.y){
            creep.memory.sitting = Math.min(256, creep.memory.sitting * 2);
        }else{
            creep.memory.sitting = 3;
        }
        creep.memory.lx = creep.pos.x;
        creep.memory.ly = creep.pos.y;

        var behave = _.get(cfg, 'behavior', false);
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
            const opts = _.get(cfg, ['work', type], false);
            let work = workers[type];
            let job = work.hydrateJob(cluster, creep.memory.jobSubType, id, creep.memory.jobAllocation);
            let endJob = (job.killed && !work.keepDeadJob(cluster, creep, opts, job)) || !work.continueJob(cluster, creep, opts, job);
            if(endJob){
                var replacement = work.end(cluster, creep, opts, job);
                if(replacement){
                    creep.memory.job = replacement.target.id;
                    creep.memory.jobType = replacement.type;
                    creep.memory.jobSubType = replacement.subtype;
                    creep.memory.jobAllocation = replacement.allocation || 1;
                    creep.job = workers[replacement.type].hydrateJob(cluster, creep.memory.jobSubType, replacement.target.id, creep.memory.jobAllocation);
                }else{
                    creep.memory.job = false;
                    creep.memory.jobType = false;
                    creep.memory.jobSubType = false;
                    creep.memory.jobAllocation = 0;
                    creep.job = null;
                }
            }else{
                creep.job = job;
            }
        }else{
            creep.job = null;
        }
        Game.federation.queue.enqueueCreep(Worker.getPriority(cluster, creep, cfg), cluster, creep);
    }

    static getPriority(cluster, creep, config){
        return creep.memory.critical ? 0 : 0.5 + (config.priority || 0);
    }

    //bid and work jobs
    static work(cluster, creep){
        const workConfig = config[creep.memory.type].work;
        if(!creep.memory.job || !creep.memory.jobType){
            var lowestBid = Infinity;
            var bidder = _.reduce(workConfig, (result, opts, type) => {
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

    static generateQuota(cluster){
        var quota = {};
        var assignments = {};
        var tickets = [];

        _.forEach(workers, worker => worker.calculateQuota(cluster, quota));
        _.forEach(workers, worker => worker.generateAssignments(cluster, assignments, quota, tickets));

        cluster.update('quota', quota);
        cluster.update('assignments', assignments);
        cluster.state.spawn = tickets;
    }
}

module.exports = Worker;