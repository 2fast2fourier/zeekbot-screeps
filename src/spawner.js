"use strict";

var creepsConfig = require('./creeps');

class Spawner {

    static process(cluster){
        var spawnlist = Spawner.generateSpawnList(cluster);
        // if(_.size(spawnlist.count) > 0){
        //     console.log(JSON.stringify(spawnlist));
        // }

        if(spawnlist.totalCost == 0){
            return;
        }

        if(_.size(spawnlist.critical) > 0){
            _.find(spawnlist.critical, (count, type)=>Spawner.attemptSpawn(cluster, spawnlist, type, count));
        }else{
            //TODO insert boosted here
            _.find(spawnlist.count, (count, type)=>Spawner.attemptSpawn(cluster, spawnlist, type, count));
        }

        // _.forEach(spawnlist.boosted, (boosts, type)=>{
        //     if(spawned){
        //         return;
        //     }
        //     var boostType = _.first(boosts);
        //     var rooms = _.get(Memory, ['boost', 'rooms', boostType], false);
        //     if(rooms){
        //         _.forEach(rooms, room => {
        //             if(spawned){
        //                 return;
        //             }
        //             var spawn = _.first(_.filter(Game.spawns, spawn => !spawn.spawning && spawn.pos.roomName == room && Spawner.canSpawn(spawn, spawnlist.parts[type], spawnlist.costs[type])));
        //             if(spawn){
        //                 spawned = Spawner.spawnCreep(spawn, spawnlist, type, catalog);
        //             }
        //         });
        //     }
        // });

        // _.forEach(Game.spawns, spawn => {
        //     if(!spawned && !spawn.spawning){
        //         spawned = Spawner.spawner(spawn, catalog, spawnlist);
        //     }
        // });
    }

    static attemptSpawn(cluster, spawnlist, type, count){
        var spawned = false;
        _.find(cluster.structures.spawn, spawn =>{
            if(!spawned && Spawner.canSpawn(spawn, spawnlist.parts[type], spawnlist.costs[type])){
                spawned = Spawner.spawnCreep(cluster, spawn, spawnlist, type);
            }
        });
        return spawned;
    }

    static generateSpawnList(cluster){
        var spawnlist = {
            boosted: {},
            costs: {},
            critical: {},
            count: {},
            parts: {},
            version: {},
            totalCost: 0
        };
        var allocation = Spawner.calculateQuotaAllocation(cluster);

        _.forEach(creepsConfig, (config, type)=>{
            let maxCost = 0;
            let version = false;
            let partSet = false;
            _.forEach(config.parts, (parts, ver) => {
                let cost = Spawner.calculateCost(parts);
                if(cost > maxCost && cost <= cluster.maxSpawn){
                    maxCost = cost;
                    version = ver;
                    partSet = parts;
                }
            });
            if(version){
                const limit = Spawner.calculateSpawnLimit(type, config);
                const quota = Spawner.calculateRemainingQuota(cluster, type, config, allocation, version);
                const need = Math.min(limit, quota);
                if(need > 0){
                    spawnlist.costs[type] = maxCost;
                    spawnlist.parts[type] = Spawner.partList(partSet);
                    spawnlist.version[type] = version;
                    if(config.critical){
                        spawnlist.critical[type] = need;
                    }
                    spawnlist.count[type] = need;
                    spawnlist.totalCost += need * spawnlist.costs[type];
                    // if(config.boost){
                    //     spawnlist.boosted[type] = _.keys(config.boost);
                    // }
                }
            }
        });

        return spawnlist;
    }

    static calculateQuotaAllocation(cluster){
        var allocation = {};
        _.forEach(cluster.creeps, creep =>{
            if(creep.spawning || !creep.ticksToLive || (creep.ticksToLive >= _.size(creep.body) * 3)){
                var quota = creep.memory.quota;
                _.set(allocation, quota, _.get(allocation, quota, 0) + creep.memory.quotaAlloc);
            }
        });

        return allocation;
    }

    static getAllocation(config, version){
        let alloc = _.get(config, 'allocation', 1);
        if(_.isString(alloc)){
            alloc = _.get(config, ['parts', version, alloc], 1);
        }
        alloc *= _.get(config, 'allocationMulti', 1);
        return Math.min(alloc, _.get(config, 'allocationMax', Infinity));
    }

    static calculateRemainingQuota(cluster, type, config, allocation, version){
        var perCreep = Spawner.getAllocation(config, version);
        var quota = Math.min(_.get(cluster.quota, config.quota, 0), _.get(config, 'maxQuota', Infinity));
        var allocated = _.get(allocation, config.quota, 0);
        let unmetQuota = quota - allocated;
        var creepsNeeded = Math.ceil(unmetQuota/perCreep);
        return creepsNeeded;
    }

    static calculateSpawnLimit(cluster, type, config){
        var limit = Infinity;
        // if(version.boost && !version.boostOptional){
        //     //TODO account for in-progress boosts
        //     _.forEach(version.boost, (parts, type) =>{
        //         if(!Memory.boost.labs[type] || _.get(Memory.boost.stored, type, 0) < 500){
        //             limit = 0;
        //         }
        //         limit = Math.min(limit, Math.floor(_.get(Memory.boost.stored, type, 0) / (parts * 30)));
        //     });
        //     // console.log(type, limit);
        // }
        return limit;
    }

    static spawnCreep(cluster, spawn, spawnlist, spawnType){
        var versionName = spawnlist.version[spawnType];
        var config = creepsConfig[spawnType];
        var spawned = spawn.createCreep(spawnlist.parts[spawnType], spawnType+'-'+Memory.uid, Spawner.prepareSpawnMemory(cluster, config, spawnType, versionName));
        Memory.uid++;
        console.log(spawn.name, 'spawning', spawned, spawnlist.costs[spawnType], 'for cluster', cluster.id);
        return spawned;
    }

    static canSpawn(spawn, parts, cost){
        return spawn.room.energyAvailable >= cost && spawn.canCreateCreep(parts) == OK;
    }

    static prepareSpawnMemory(cluster, config, type, version){
        var memory = {
            type,
            version,
            cluster: cluster.id,
            job: false,
            jobType: false,
            jobSubType: false,
            jobAllocation: 0,
            quota: config.quota,
            quotaAlloc: Spawner.getAllocation(config, version)
        };
        
        if(config.critical){
            memory.critical = true;
        }

        if(config.boost){
            memory.boost = _.keys(config.boost);
            if(!_.has(memory, 'behavior.boost')){
                _.set(memory, 'behavior.boost', {});
            }
        }

        if(config.assignRoom){
            memory.room = Spawner.getRoomAssignment(cluster, type, config);
            memory.roomtype = config.assignRoom;
            console.log('Assigned', type, 'to room', memory.room, '-', memory.roomtype);
        }

        if(config.memory){
            _.assign(memory, config.memory);
        }

        return memory;
    }

    static partList(args){
        var parts = [];
        _.forEach(args, (count, name)=>{
            for(var iy=0;iy<count;iy++){
                parts.push(name);
            }
        });
        return parts;
    }

    static calculateCost(partList){
        var prices = { work: 100, carry: 50, move: 50, attack: 80, tough: 10, ranged_attack: 150, claim: 600, heal: 250 };
        var cost = 0;
        _.forEach(partList, (count, name)=>{
            cost += prices[name] * count;
        });
        return cost;
    }

    static getRoomAssignment(cluster, spawnType, config){
        let type = config.assignRoom;

        let assignments = _.reduce(Game.creeps, (result, creep)=>{
            if(creep.memory.room && creep.memory.roomtype == type){
                _.set(result, creep.memory.room, _.get(result, creep.memory.room, 0) + (creep.ticksToLive / 1500));
            }
            return result;
        }, {});
        
        var least = Infinity;
        var targetRoom = false;
        _.forEach(cluster.assignments[type], (target, roomName) => {
            var assigned = _.get(assignments, roomName, 0) / target;
            if(assigned < least){
                least = assigned;
                targetRoom = roomName;
            }
        });
        if(targetRoom){
            return targetRoom;
        }else{
            return false;
        }
    }

    // static resetBehavior(catalog){
    //     var classConvert = {
    //         keepminer: 'miner',
    //         keepfighter: 'fighter',
    //         tender: 'hauler'
    //     }
    //     var classFallback = {
    //         miner: 'milli',
    //         hauler: 'micro',
    //         worker: 'repair',
    //         healer: 'pico',
    //         fighter: 'melee'
    //     }
    //     _.forEach(Game.creeps, creep=>{
    //         var newClass = _.get(classConvert, creep.memory.class, creep.memory.class);
    //         var newVer = creep.memory.version;
    //         var config = _.get(classConfig, newClass, false);
    //         if(!config){
    //             console.log('failed to find class', creep.memory.class, creep);
    //             return;
    //         }
    //         var version = _.get(config, ['versions', creep.memory.version], false);
    //         if(!version){
    //             newVer = classFallback[newClass];
    //             version = _.get(config, ['versions', newVer], false);
    //             if(!version){
    //                 console.log('failed to find version', creep.memory.version);
    //                 return;
    //             }
    //             console.log('converting from', creep.memory.version, 'to', newVer, creep);
    //         }
    //         creep.memory.version = newVer;
    //         creep.memory.type = newVer + newClass;
    //         creep.memory.class = newClass;
    //         creep.memory.rules = version.rules || config.rules;
    //         creep.memory.actions = version.actions || config.actions;
    //         creep.memory.jobId = false;
    //         creep.memory.jobType = false;
    //         creep.memory.jobAllocation = 0;
    //         creep.memory.moveTicks = 0;
    //         var optMemory = version.memory || config.memory;
    //         if(optMemory){
    //             _.assign(creep.memory, optMemory);
    //         }
    //     });
    //     Memory.resetBehavior = false;
    //     console.log("Reset behavior!");
    // }
}


module.exports = Spawner;