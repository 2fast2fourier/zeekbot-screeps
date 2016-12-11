"use strict";

var Work = require('./work');

class WorkManager {
    static process(catalog){
        var workers = Work(catalog);
        _.forEach(Game.creeps, creep => WorkManager.validateCreep(creep, workers, catalog));
        _.forEach(Game.creeps, creep => WorkManager.bidCreep(creep, workers, catalog));
        _.forEach(Game.creeps, creep => WorkManager.processCreep(creep, workers, catalog));
    }

    static validateCreep(creep, workers, catalog){
        if(creep.memory.jobType){
            if(!workers[creep.memory.jobType].stillValid(creep, creep.memory.rules[creep.memory.jobType])){
                workers[creep.memory.jobType].stop(creep, creep.memory.rules[creep.memory.jobType]);
                creep.memory.jobId = false;
                creep.memory.jobType = false;
                creep.memory.jobAllocation = 0;
            }
        }
    }

    static bidCreep(creep, workers, catalog){
        if(!creep.memory.jobType){
            var lowestBid = 99999999;
            var bidder = _.reduce(creep.memory.rules, (result, rule, type) => {
                if(!workers[type]){
                    console.log('missing worker', type);
                    return result;
                }
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

    static processCreep(creep, workers, catalog){
        if(creep.memory.jobType){
            workers[creep.memory.jobType].process(creep, creep.memory.rules[creep.memory.jobType]);
        }
    }
}

module.exports = WorkManager;