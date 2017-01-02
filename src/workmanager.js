"use strict";

var Actions = require('./actions');
var Work = require('./work');

class WorkManager {
    static process(catalog){
        var start = Game.cpu.getUsed();
        var workers = Work(catalog);
        var actions = Actions(catalog);
        var creeps = _.filter(Game.creeps, creep => !creep.spawning);

        _.forEach(creeps, creep => WorkManager.validateCreep(creep, workers, catalog));


        var validate = Game.cpu.getUsed();
        catalog.profile('work-validate', validate - start);
        
        var blocks = _.map(creeps, creep => WorkManager.creepAction(creep, actions, catalog));
        
        var startBid = Game.cpu.getUsed();
        catalog.profile('work-block', startBid - validate);

        _.forEach(creeps, creep => WorkManager.bidCreep(creep, workers, catalog, startBid));

        var bid = Game.cpu.getUsed();
        catalog.profile('work-bid', bid - startBid);

        
        _.forEach(creeps, (creep, ix) => WorkManager.processCreep(creep, workers, catalog, actions, blocks[ix]));
        catalog.profile('work-process', Game.cpu.getUsed() - bid);
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
            if(result){
                return result;
            }
            var blocking = actions[type].shouldBlock(creep, opts);
            if(blocking){
                return { type, data: blocking };
            }
            return result;
        }, false);
        creep.memory.block = !!block;
        return block;
    }

    static bidCreep(creep, workers, catalog, startTime){
        if(!creep.memory.jobType && !creep.memory.block){
            if(Game.cpu.bucket < 5000 && Game.cpu.getUsed() - startTime > 10){
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
            var start = Game.cpu.getUsed();
            action = workers[creep.memory.jobType].process(creep, creep.memory.rules[creep.memory.jobType]);
            catalog.profileAdd('work-process-'+creep.memory.jobType, Game.cpu.getUsed() - start);
        }
        if(block){
            actions[block.type].blocked(creep, creep.memory.actions[block.type], block.data);
        }else{
            _.forEach(creep.memory.actions, (opts, type) => actions[type].postWork(creep, opts, action));
        }
    }
}

module.exports = WorkManager;