"use strict";

const config = require('../creeps');

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
    transfer: require('./transfer'),
    upgrade: require('./upgrade')
};

const Behavior = require('../behavior');

class Worker {

    static process(cluster){
        const workers = _.mapValues(workerCtors, ctor => new ctor());
        const behaviors = Behavior();

        _.forEach(workers, worker => worker.pretick(cluster));
        // Game.perfAdd();
        const creeps = _.filter(cluster.creeps, 'ticksToLive');
        _.forEach(creeps, Worker.validate.bind(this, workers, behaviors, cluster));
        // Game.perfAdd('validate');
        _.forEach(creeps, Worker.work.bind(this, workers, behaviors, cluster));
        // Game.perfAdd('work');

        if(Game.interval(20) || cluster.requestedQuota){
            Worker.generateQuota(workers, cluster);
        }
        // Game.perfAdd('quota');
    }

    //hydrate, validate, and end jobs
    static validate(workers, behaviors, cluster, creep){
        if(creep.memory.cpu === undefined){
            creep.memory.cpu = 0;
        }
        var validateStart = Game.cpu.getUsed();
        if(creep.memory.lx == creep.pos.x && creep.memory.ly == creep.pos.y){
            creep.memory.sitting = Math.min(256, creep.memory.sitting * 2);
        }else{
            creep.memory.sitting = 3;
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
            var profStart;
            if(work.profile){
                profStart = Game.cpu.getUsed();
            }
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
            if(work.profile){
                Game.profileAdd('valid-'+type, Game.cpu.getUsed() - profStart);
            }
        }else{
            creep.job = null;
        }
        var validateDelta = Game.cpu.getUsed() - validateStart;
        Game.profileAdd(creep.memory.type, validateDelta);
        creep.memory.cpu += validateDelta;
    }

    //bid and work jobs
    static work(workers, behaviors, cluster, creep){
        var workStart = Game.cpu.getUsed();
        const workConfig = config[creep.memory.type].work;
        if(!creep.memory.job){
            var lowestBid = Infinity;
            var bidder = _.reduce(workConfig, (result, opts, type) => {
                if(!workers[type]){
                    console.log('missing worker', type);
                    return result;
                }
                if(workers[type].profile){
                    Game.perfAdd();
                }
                var bid = workers[type].bid(cluster, creep, opts);
                if(workers[type].profile){
                    Game.perfAdd('bid-'+type);
                }
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
                if(workers[type].profile){
                    Game.perfAdd();
                }
                action = workers[type].process(cluster, creep, workConfig[type], job, job.target);
                if(workers[type].profile){
                    Game.perfAdd('work-'+type);
                }
            }
            _.forEach(behave, (opts, type) => behaviors[type].postWork(cluster, creep, opts, action));
        }
        var workDelta = Game.cpu.getUsed() - workStart;
        Game.profileAdd(creep.memory.type, workDelta);
        creep.memory.cpu += workDelta;
        if(creep.memory.cpu > 1200 && creep.memory.quota != 'transfer' && creep.memory.quota != 'spawnhauler' && creep.memory.type != 'attacker'){
            console.log('CPU Exceeded: ' + creep.memory.cluster + ' - ' + creep.name + ' - ' + creep.memory.cpu + ' - ' + creep.ticksToLive);
            Game.notify('CPU Exceeded: ' + creep.memory.cluster + ' - ' + creep.name + ' - ' + creep.memory.cpu + ' - ' + creep.ticksToLive);
            creep.suicide();
        }
    }

    static generateQuota(workers, cluster){
        var quota = {};
        var assignments = {};
        let cores = cluster.getRoomsByRole('core');
        let keeper = cluster.getRoomsByRole('keep');
        let harvest = cluster.getRoomsByRole('harvest');

        _.forEach(workers, worker => worker.calculateQuota(cluster, quota));

        assignments.spawn = _.zipObject(_.map(cores, 'name'), new Array(cores.length).fill(1));
        assignments.tower = _.zipObject(_.map(cores, 'name'), new Array(cores.length).fill(1));
        assignments.harvest = _.zipObject(_.map(harvest, 'name'), _.map(harvest, room => _.size(cluster.find(room, FIND_SOURCES))));
        for(let keepRoom of keeper){
            let sources = cluster.find(keepRoom, FIND_SOURCES);
            let harvestFactor = 1.5;
            let closest = cluster.findClosestCore(_.first(sources));
            if(closest){
                harvestFactor = Math.max(1, 0.5 + Math.min(2, closest.distance / 75));
            }
            assignments.harvest[keepRoom.name] = Math.ceil(sources.length * harvestFactor);
        }
        for(let coreRoom of cores){
            if(coreRoom.memory.harvest){
                assignments.harvest[coreRoom.name] = 1;
            }
        }

        quota.spawnhauler = _.sum(_.map(cores, room => Math.min(1650, room.energyCapacityAvailable)));

        if(_.size(cluster.structures.storage) > 0){
            quota.harvesthauler = _.sum(assignments.harvest) * 24;
        }

        if(cluster.maxRCL < 5 && cluster.structures.spawn.length > 0){
            quota['stockpile-deliver'] = Math.min(quota['stockpile-deliver'], 250 * cluster.maxRCL);
        }

        if(cluster.maxRCL >= 7){
            assignments.keep = _.zipObject(_.map(keeper, 'name'), new Array(keeper.length).fill(1));
            quota.keep = _.sum(assignments.keep);
            if(quota.keep > 0){
                quota.keep++;
            }
        }

        cluster.update('quota', quota);
        cluster.update('assignments', assignments);
    }
}

module.exports = Worker;