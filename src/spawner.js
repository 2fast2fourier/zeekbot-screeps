"use strict";

const creepsConfig = require('./creeps');

const spawnFreeCheck = function(spawn){
    return spawn.spawning === null;
};

class Spawner {

    static processSpawnlist(cluster, spawnlist, targetCluster){
        if(spawnlist.totalCost == 0 || targetCluster.spawned){
            return;
        }
        var spawners = _.sortBy(_.filter(cluster.structures.spawn, spawnFreeCheck), spawn => spawn.room.energyAvailable);

        let result = false;
        if(spawnlist.critical.length > 0){
            result = _.find(spawnlist.critical, Spawner.attemptSpawn.bind(Spawner, cluster, targetCluster, spawners));
        }else{
            result = _.find(spawnlist.queue, Spawner.attemptSpawn.bind(Spawner, cluster, targetCluster, spawners));
        }
        return !!result;
    }

    static attemptSpawn(cluster, targetCluster, spawners, entry){
        for(let spawner of spawners){
            if(Spawner.canSpawn(spawner, entry.parts, entry.cost)){
                let result = Spawner.spawnCreep(targetCluster, cluster, spawner, entry);
                if(result){
                    _.pull(spawners, spawner);
                    return true;
                }
            }
        }
        return false;
    }

    static hasFreeSpawn(cluster){
        return _.any(cluster.structures.spawn, spawnFreeCheck);
    }

    static generateSpawnList(cluster, targetCluster){
        var critical = [];
        var queue = [];
        var totalCost = 0;

        var allocation = Spawner.calculateQuotaAllocation(targetCluster);

        var tickets = targetCluster.state.spawn || [];
        for(let ticket of tickets){
            let quotaId = 'ticket-'+ticket.tag+'-'+ticket.id;
            let capacity = ticket.capacity || 1;
            let allocated = allocation[quotaId] || 0;
            let need = capacity - allocated;
            if(need > 0){
                let config = creepsConfig[ticket.type];
                if(!config){
                    console.log('Invalid config!', ticket.type);
                    Game.notify('Invalid config! ' + ticket.type);
                    continue;
                }
                let data = {};
                if(ticket.parts){
                    let cost = Spawner.calculateCost(ticket.parts);
                    if(cost <= cluster.maxSpawn){
                        data = {
                            boosts: ticket.boosts,
                            maxCost: cost,
                            partSet: ticket.parts,
                            type: ticket.type,
                            version: ticket.version || 'custom'
                        }
                    }
                }else{
                    data = Spawner.findVersion(cluster, targetCluster, ticket.type, config, allocation);
                    if(ticket.boosts){
                        data.boosts = ticket.boosts;
                    }
                }
                if(data.version){
                    totalCost += need * data.maxCost;
                    let priorityOffset = config.priorityOffset || 0;
                    let entry = Spawner.generateCreepEntry(data, config, need, (allocated / capacity) + priorityOffset);
                    entry.quota = quotaId;
                    entry.memory = ticket.memory;
                    if(config.critical){
                        critical.push(entry);
                    }else{
                        queue.push(entry);
                    }
                }
            }
        }

        _.forEach(creepsConfig, (config, type)=>{
            if(config.deprecated || !config.quota){
                return;
            }
            let data = Spawner.findVersion(cluster, targetCluster, type, config, allocation);

            if(data.version){
                const limit = Spawner.calculateBoostCapacity(targetCluster, config, data.version, cluster);
                const quota = Spawner.calculateRemainingQuota(targetCluster, type, config, allocation, data.version);
                const need = Math.min(limit, quota);
                if(need > 0){
                    totalCost += need * data.maxCost;
                    let totalQuota = Spawner.calculateTotalQuota(targetCluster, config, data.version);
                    let priorityOffset = config.priorityOffset || 0;
                    let entry = Spawner.generateCreepEntry(data, config, need, ((totalQuota - quota) / totalQuota) + priorityOffset);
                    if(config.critical){
                        critical.push(entry);
                    }else{
                        queue.push(entry);
                    }
                }
            }
        });

        return {
            critical: _.sortBy(critical, 'priority'),
            queue: _.sortBy(queue, 'priority'),
            totalCost
        };
    }

    static findVersion(cluster, targetCluster, type, config, allocation){
        let maxSpawnCapacity = config.spawnAny ? cluster.maxSpawnEnergy : cluster.maxSpawn;
        let maxCost = 0;
        let version = false;
        let partSet = false;
        let boosts = false;
        _.forEach(config.parts, (parts, ver) => {
            let cost = Spawner.calculateCost(parts);
            let hasCapacity = !config.boost || !config.boost[ver] || Spawner.calculateBoostCapacity(targetCluster, config, ver, cluster) > 0;
            if(cost > maxCost && cost <= maxSpawnCapacity && hasCapacity){
                maxCost = cost;
                version = ver;
                partSet = parts;
                boosts = config.boost ? config.boost[ver] : false;
            }
        });
        return {
            boosts,
            maxCost,
            partSet,
            type,
            version
        };
    }

    static generateCreepEntry(data, config, need, priority){
        return {
            type: data.type,
            need,
            boost: data.boosts,
            cost: data.maxCost,
            parts: Spawner.partList(data.partSet),
            version: data.version,
            critical: config.critical,
            priority
        };
    }

    static calculateQuotaAllocation(targetCluster){
        var allocation = {};
        _.forEach(targetCluster.creeps, creep =>{
            var offset = creep.memory.spawnOffset || 0;
            if(creep.spawning || !creep.ticksToLive || (creep.ticksToLive >= _.size(creep.body) * 3 + offset)){
                var quota = creep.memory.quota;
                allocation[quota] = (allocation[quota] || 0) + creep.memory.quotaAlloc;
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

    static calculateTotalQuota(targetCluster, config, version){
        var perCreep = Spawner.getAllocation(config, version);
        var quota = Math.min(_.get(targetCluster.quota, config.quota, 0), _.get(config, 'maxQuota', Infinity));
        return Math.ceil(quota / perCreep);
    }

    static calculateSpawnLimit(cluster, type, config, version){
        var limit = Infinity;
        if(config.boost && config.boost[version]){
            limit = Spawner.calculateBoostCapacity(cluster, config, version);
        }
        return limit;
    }

    static calculateBoostCapacity(cluster, config, version, originCluster){
        if(config.boost && config.boost[version]){
            return _.min(_.map(config.boost[version], (amount, type) => Math.floor((_.get(originCluster.boostMinerals, Game.boosts[type], 0) / 30) / amount)));
        }
        return Infinity;
    }

    static spawnCreep(targetCluster, originCluster, spawn, entry){
        var config = creepsConfig[entry.type];
        var mem = Spawner.prepareSpawnMemory(targetCluster, originCluster, config, entry);
        var spawned = spawn.createCreep(entry.parts, entry.type+'-'+Memory.uid, mem);
        Memory.uid++;
        if(_.isString(spawned)){
            console.log(targetCluster.id, '-', spawn.name, 'spawning', spawned, entry.cost);
            originCluster.longtermAdd('spawn', _.size(entry.parts) * 3);
            targetCluster.spawned = true;
            return true;
        }else{
            Game.notify('Could not spawn!', targetCluster.id, entry.type, spawn.name, spawned);
            return false;
        }
    }

    static canSpawn(spawn, parts, cost){
        return spawn.room.energyAvailable >= cost && spawn.canCreateCreep(parts) == OK;
    }

    static prepareSpawnMemory(targetCluster, originCluster, config, entry){
        var version = entry.version;
        var memory = {
            type: entry.type,
            version,
            cluster: targetCluster.id,
            job: false,
            jobType: false,
            jobSubType: false,
            jobAllocation: 0,
            quota: entry.quota || config.quota,
            quotaAlloc: entry.quota ? 1 : Spawner.getAllocation(config, version)
        };
        
        if(config.critical){
            memory.critical = true;
        }
        
        if(config.offset > 0){
            memory.spawnOffset = config.offset;
        }

        if(entry.boost){
            memory.boost = _.clone(entry.boost);
            if(originCluster.id != targetCluster.id){
                memory.boostCluster = originCluster.id;
                console.log('Cross-spawn boost', entry.type, targetCluster.id, originCluster.id);
            }
        }

        if(config.assignRoom){
            memory.room = Spawner.getRoomAssignment(targetCluster, entry.type, config);
            memory.roomtype = config.assignRoom;
            console.log('Assigned', entry.type, 'to room', memory.room, '-', memory.roomtype);
        }

        if(config.memory){
            _.assign(memory, config.memory);
        }

        if(originCluster.id != targetCluster.id){
            memory.bootstrap = true;
        }

        if(entry.memory){
            _.assign(memory, entry.memory);
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