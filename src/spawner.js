"use strict";

var creepsConfig = require('./creeps');

class Spawner {

    static processSpawnlist(cluster, spawnlist, targetCluster){
        if(spawnlist.totalCost == 0){
            return;
        }

        let result = false;
        if(_.size(spawnlist.critical) > 0){
            result = _.find(spawnlist.critical, (count, type)=>Spawner.attemptSpawn(cluster, spawnlist, type, count, targetCluster));
        }else{
            result = _.find(spawnlist.count, (count, type)=>Spawner.attemptSpawn(cluster, spawnlist, type, count, targetCluster));
        }
        return !!result;
    }

    static attemptSpawn(cluster, spawnlist, type, count, targetCluster){
        var spawned = false;
        _.find(cluster.structures.spawn, spawn =>{
            if(!spawned && Spawner.canSpawn(spawn, spawnlist.parts[type], spawnlist.costs[type])){
                spawned = Spawner.spawnCreep(targetCluster, spawn, spawnlist, type);
            }
        });
        return spawned;
    }

    static generateSpawnList(cluster, targetCluster){
        var spawnlist = {
            costs: {},
            critical: {},
            count: {},
            parts: {},
            version: {},
            totalCost: 0
        };
        var allocation = Spawner.calculateQuotaAllocation(targetCluster);

        _.forEach(creepsConfig, (config, type)=>{
            let emergency = cluster.id == targetCluster.id && config.critical && config.emergency && _.get(allocation, config.quota, 0) == 0;
            let maxCost = 0;
            let version = false;
            let partSet = false;
            if(emergency){
                let cost = Spawner.calculateCost(config.parts[config.emergency]);
                maxCost = cost;
                version = config.emergency;
                partSet = config.parts[config.emergency];
                // Game.notify('EMERGENCY! Spawning ' + version + ' - ' + type + ' in ' + targetCluster.id);
            }else{
                _.forEach(config.parts, (parts, ver) => {
                    let cost = Spawner.calculateCost(parts);
                    if(cost > maxCost && cost <= cluster.maxSpawn){
                        maxCost = cost;
                        version = ver;
                        partSet = parts;
                    }
                });
            }
            if(version){
                const limit = Spawner.calculateSpawnLimit(cluster, type, config, version);
                const quota = Spawner.calculateRemainingQuota(targetCluster, type, config, allocation, version);
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
                }
            }
        });

        return spawnlist;
    }

    static calculateQuotaAllocation(targetCluster){
        var allocation = {};
        _.forEach(targetCluster.creeps, creep =>{
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

    static calculateRemainingQuota(targetCluster, type, config, allocation, version){
        var perCreep = Spawner.getAllocation(config, version);
        var quota = Math.min(_.get(targetCluster.quota, config.quota, 0), _.get(config, 'maxQuota', Infinity));
        var allocated = _.get(allocation, config.quota, 0);
        let unmetQuota = quota - allocated;
        var creepsNeeded = Math.ceil(unmetQuota/perCreep);
        return creepsNeeded;
    }

    static calculateSpawnLimit(cluster, type, config, version){
        var limit = Infinity;
        if(config.boost && config.boost[version]){
            limit = _.min(_.map(config.boost[version], (amount, type) => Math.floor((_.get(cluster.boostMinerals, Game.boosts[type], 0) / 30) / amount)));
        }
        return limit;
    }

    static spawnCreep(cluster, spawn, spawnlist, spawnType){
        var versionName = spawnlist.version[spawnType];
        var config = creepsConfig[spawnType];
        var mem = Spawner.prepareSpawnMemory(cluster, config, spawnType, versionName);
        if(spawn.room.memory.cluster != cluster.id){
            mem.bootstrap = true;
        }
        var spawned = spawn.createCreep(spawnlist.parts[spawnType], spawnType+'-'+Memory.uid, mem);
        Memory.uid++;
        console.log(cluster.id, '-', spawn.name, 'spawning', spawned, spawnlist.costs[spawnType]);
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

        if(config.boost && config.boost[version]){
            memory.boost = _.clone(config.boost[version]);
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
                _.set(result, creep.memory.room, _.get(result, creep.memory.room, 0) + (_.get(creep, 'ticksToLive', 1500) / 1500));
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
            Game.note('spawnAssignFailed', 'Failed to assign room '+type+' - '+spawnType+' - '+JSON.stringify(assignments));
            return false;
        }
    }
}


module.exports = Spawner;