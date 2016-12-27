"use strict";

var Actions = require('./actions');
var Work = require('./work');

class WorkManager {
    static process(catalog){
        // var start = Game.cpu.getUsed();

        var workers = Work(catalog);
        var actions = Actions(catalog);
        var creeps = _.filter(Game.creeps, creep => !creep.spawning);

        // var prep = Game.cpu.getUsed();

        _.forEach(creeps, creep => WorkManager.validateCreep(creep, workers, catalog));

        // var validate = Game.cpu.getUsed();
        
        var blocks = _.map(creeps, creep => WorkManager.creepAction(creep, actions, catalog));
        // console.log(blocks.length, _.compact(blocks.length).length);

        // var action = Game.cpu.getUsed();
        
        var startBid = Game.cpu.getUsed();
        _.forEach(creeps, creep => WorkManager.bidCreep(creep, workers, catalog, startBid));

        var bid = Game.cpu.getUsed();
        
        _.forEach(creeps, (creep, ix) => WorkManager.processCreep(creep, workers, catalog, actions, blocks[ix]));

        // var work = Game.cpu.getUsed();
        // console.log('---- start', Game.cpu.bucket, start, Game.cpu.getUsed() - start, Game.cpu.getUsed(), '----');
        // console.log('prep', prep - start);
        // console.log('validate', validate - prep);
        // console.log('action', action - validate);
        // console.log('bid', bid - action);
        // console.log('work', work - bid);
    }

    static validateCreep(creep, workers, catalog){
        if(creep.memory.jobType){
            if(!workers[creep.memory.jobType].stillValid(creep, creep.memory.rules[creep.memory.jobType])){
                workers[creep.memory.jobType].stop(creep, creep.memory.rules[creep.memory.jobType]);
                catalog.jobs.removeAllocation(creep.memory.jobType, creep.memory.jobId, creep.memory.jobAllocation);
                creep.memory.jobId = false;
                creep.memory.jobType = false;
                creep.memory.jobAllocation = 0;
            }
        }
    }

    static creepAction(creep, actions, catalog){
        var block = _.reduce(creep.memory.actions, (result, opts, type) => {
            actions[type].preWork(creep, opts);
            return actions[type].shouldBlock(creep, opts) || result;
        }, false);
        creep.memory.block = !!block;
        return block;
    }

    static bidCreep(creep, workers, catalog, startTime){
        if(!creep.memory.jobType){
            if(Game.cpu.bucket < 9000 && Game.cpu.getUsed() - startTime > 10){
                return;
            }
            var lowestBid = 99999999;
            var bidder = _.reduce(creep.memory.rules, (result, rule, type) => {
                var bid = workers[type].bid(creep, rule);
                if(bid !== false && bid.bid < lowestBid){
                    lowestBid = bid.bid;
                    return bid;
                }
                return result;
            }, false);

            if(bidder !== false){
                creep.memory.jobId = _.get(bidder, 'job.id', false);
                creep.memory.jobType = bidder.type;
                creep.memory.jobAllocation = _.get(bidder, 'allocation', 0);
                catalog.jobs.addAllocation(creep.memory.jobType, creep.memory.jobId, creep.memory.jobAllocation);
                workers[creep.memory.jobType].start(creep, bidder, creep.memory.rules[creep.memory.jobType]);
                if(workers[creep.memory.jobType].debug){
                    console.log(creep.memory.jobType, creep, bidder.job.target);
                }
            }
        }
    }

    static processCreep(creep, workers, catalog, actions, block){
        var action = false;
        if(creep.memory.jobType && !creep.memory.block){
            action = workers[creep.memory.jobType].process(creep, creep.memory.rules[creep.memory.jobType]);
        }
        _.forEach(creep.memory.actions, (opts, type) => actions[type].postWork(creep, opts, action, block));
    }
}

module.exports = WorkManager;