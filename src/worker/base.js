"use strict";

class BaseWorker {
    constructor(type, opts){
        this.minEnergy = 1000;
        this.range = 1;
        this.priority = 0;
        if(opts){
            Object.assign(this, opts);
        }
        this.type = type;
        this.hydratedJobs = {};
        this.jobs = {};
    }

    genTarget(cluster, subtype, id, args){
        if(args){
            return Game.getObjectById(args.id);
        }else{
            return Game.getObjectById(id);
        }
    }

    parseJob(cluster, subtype, id, allocation){
        let args = false;
        let target;
        if(this.args){
            args = _.zipObject(this.args, id.split('-'));
        }
        target = this.genTarget(cluster, subtype, id, args);
        let capacity = 0;
        if(target){
            capacity = this.calculateCapacity(cluster, subtype, id, target, args);
        }
        return {
            capacity,
            allocation,
            id,
            type: this.type,
            subtype,
            target,
            args
        };
    }

    createId(cluster, subtype, target, args){
        if(this.args){
            return _.map(this.args, argName => argName == 'id' ? target.id : args[argName]).join('-');
        }else{
            return target.id
        }
    }

    createJob(cluster, subtype, target, args){
        let id = this.createId(cluster, subtype, target, args);
        return {
            capacity: this.calculateCapacity(cluster, subtype, id, target, args),
            allocation: 0,
            id,
            type: this.type,
            subtype,
            target,
            args
        };
    }

    jobsForTargets(cluster, subtype, targets, args){
        return _.map(targets, target => this.createJob(cluster, subtype, target, args));
    }

    hydrateJob(cluster, subtype, id, allocation){
        let job = _.get(this.hydratedJobs, [this.type, subtype, id]);
        if(job){
            job.allocation += allocation;
        }else{
            job = this.parseJob(cluster, subtype, id, allocation);
            job.killed = !this.jobValid(cluster, job);
            _.set(this.hydratedJobs, [this.type, subtype, id], job);
        }
        return job;
    }

    registerAllocation(cluster, job, allocated){
        if(!_.has(this.hydratedJobs, [job.type, job.subtype, job.id])){
            _.set(this.hydratedJobs, [job.type, job.subtype, job.id], job);
        }
        let newAlloc = allocated + _.get(this.hydratedJobs, [job.type, job.subtype, job.id, 'allocation'], 0);
        _.set(this.hydratedJobs, [job.type, job.subtype, job.id, 'allocation'], newAlloc);
    }

    move(creep, target){
        if(this.simpleMove){
            if(creep.memory.lastX != creep.pos.x || creep.memory.lastY != creep.pos.y){
                creep.memory.lastX = creep.pos.x;
                creep.memory.lastY = creep.pos.y;
                creep.memory.moveTicks = 0;
            }else if(creep.memory.moveTicks >= 3){
                delete creep.memory._move;
            }else{
                creep.memory.moveTicks++;
            }
            return creep.moveTo(target, { reusePath: 50 });
        }else{
            let range = this.range;
            if(range > 1 && (target.pos.x < 2 || target.pos.y < 2 || target.pos.x > 47 || target.pos.y > 47)){
                range = 1;
            }
            return creep.travelTo(target, { allowSK: false, ignoreCreeps: false, range });
        }
    }

    orMove(creep, target, result){
        if(result == ERR_NOT_IN_RANGE){
            this.move(creep, target);
        }
        return result;
    }

    moveAway(creep, target, range){
        var result = PathFinder.search(creep.pos, { pos: target.pos, range }, { flee: true });
        creep.moveByPath(result.path);
    }

    calculateQuota(cluster, quota){
        if(this.quota === true){
            let jobs = this.generateJobs(cluster, this.type);
            quota[this.type] = _.sum(jobs, job => job.capacity);
        }else if(this.quota){
            _.forEach(this.quota, subtype => {
                let jobs = this.generateJobs(cluster, subtype);
                quota[subtype+'-'+this.type] = _.sum(jobs, job => job.capacity);
            });
        } 
    }

    //// Lifecycle ////
    calculateCapacity(cluster, subtype, id, target, args){
        return 1;
    }

    allocate(cluster, creep, opts){
        return 1;
    }

    jobValid(cluster, job){
        return job.id && job.target;
    }

    continueJob(cluster, creep, opts, job){
        if(this.requiresEnergy){
            return job.id && job.target && creep.getResource(RESOURCE_ENERGY) > 0;
        }
        return job.id && job.target;
    }

    keepDeadJob(cluster, creep, opts, job){
        return false;
    }

    generateJobs(cluster, subtype){
        if(this.requiresEnergy && cluster.totalEnergy < this.minEnergy && this.critical != subtype && !cluster.bootstrap){
            return [];
        }
        var jobs = this.jobs[subtype];
        if(!jobs){
            // console.log('generating jobs for', subtype);
            jobs = this.generateJobsForSubtype(cluster, subtype);
            this.jobs[subtype] = jobs;
        }
        return jobs;
    }

    generateJobsForSubtype(cluster, subtype){
        return this[subtype](cluster, subtype);
    }

    canBid(cluster, creep, opts){
        return !this.requiresEnergy || creep.carry.energy > 0;
    }

    bid(cluster, creep, opts){
        if(!this.canBid(cluster, creep, opts)){
            return false;
        }
        let subtype = _.get(opts, 'subtype', this.type);
        let jobs = this.generateJobs(cluster, subtype);
        let lowestBid = Infinity;
        return _.reduce(jobs, (result, job) =>{
            if(job.capacity <= _.get(this.hydratedJobs, [this.type, subtype, job.id, 'allocation'], 0)){
                return result;
            }
            let distance = creep.pos.getPathDistance(job.target);
            if(opts.local && creep.memory.room && creep.memory.room != _.get(job, 'target.pos.roomName')){
                return result;
            }
            let bid = this.calculateBid(cluster, creep, opts, job, distance);
            if(bid !== false){
                bid += _.get(opts, 'priority', this.priority);
                if(bid < lowestBid){
                    let allocation = this.allocate(cluster, creep, opts, job);
                    lowestBid = bid;
                    return { allocation, bid, job, type: this.type, subtype };
                }
            }
            return result;
        }, false);
    }

    calculateBid(cluster, creep, opts, job){
        return false;
    }

    start(cluster, creep, opts, job){}
    process(cluster, creep, opts, job, target){}
    end(cluster, creep, opts, job){}

}

module.exports = BaseWorker;