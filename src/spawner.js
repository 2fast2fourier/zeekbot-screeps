"use strict";

var classConfig = require('./creeps');

class Spawner {

    static spawn(catalog){
        var start = Game.cpu.getUsed();
        if(Memory.resetBehavior){
            Spawner.resetBehavior(catalog);
        }

        var spawnlist = Spawner.generateSpawnList(catalog);
        Memory.spawnlist = spawnlist;

        if(spawnlist.totalCost == 0){
            return;
        }

        var spawned = false;
        _.forEach(Game.spawns, spawn => {
            if(!spawned && !spawn.spawning){
                spawned = Spawner.spawner(spawn, catalog, spawnlist);
            }
        });

        catalog.profile('spawner', Game.cpu.getUsed() - start);
    }

    static generateSpawnList(catalog){
        var spawnlist = {
            costs: {},
            critical: {},
            spawn: {},
            parts: {},
            version: {},
            class: {},
            totalCost: 0
        };
        var allocation = Spawner.calculateQuotaAllocation(catalog);
        
        _.forEach(classConfig, (config, className)=>{
            _.forEach(config.versions, (version, versionName)=>{
                var type = versionName+className;
                var limit = Spawner.calculateSpawnLimit(catalog, type, version, config);
                var quota = Spawner.calculateRemainingQuota(catalog, type, version, config, allocation);
                var need = Math.min(limit, quota);
                if(need > 0){
                    spawnlist.costs[type] = Spawner.calculateCost(version.parts || config.parts);
                    if(version.critical){
                        spawnlist.critical[type] = need;
                    }
                    spawnlist.parts[type] = Spawner.partList(version.parts);
                    spawnlist.version[type] = versionName;
                    spawnlist.class[type] = className;
                    spawnlist.spawn[type] = need;
                    spawnlist.totalCost += need * spawnlist.costs[type];
                }
            });
        });

        return spawnlist;
    }

    static calculateQuotaAllocation(catalog){
        var allocation = {};
        _.forEach(classConfig, (config, className)=>{
            _.forEach(config.versions, (version, versionName)=>{
                var type = versionName+className;
                var quota = version.quota || config.quota;
                if(quota){
                    var allocate = _.get(version, 'allocation', 1);
                    _.set(allocation, quota, _.get(allocation, quota, 0) + (_.get(catalog.creeps.type, [type, 'length'], 0) * allocate));
                }

            });
        });

        return allocation;
    }

    static calculateRemainingQuota(catalog, type, version, config, allocation){
        var quota = version.quota || config.quota;
        if(quota){
            var capacity = catalog.quota.get(quota);
            var creepsNeeded = Math.ceil(capacity/_.get(version, 'allocation', 1));
            var existing = Math.ceil(_.get(allocation, quota, 0)/_.get(version, 'allocation', 1));
            return Math.min(creepsNeeded, _.get(version, 'max', Infinity)) - existing;
        }
        return 0;
    }

    static calculateSpawnLimit(catalog, type, version, config){
        var limit = Infinity;
        if(version.boost){
            //TODO account for in-progress boosts
            _.forEach(version.boost, (parts, type) =>{
                if(!Memory.boost.labs[type]){
                    limit = 0;
                }
                limit = Math.min(limit, Math.floor(_.get(Memory.boost.stored, type, 0) / (parts * 30)));
            });
            // console.log(type, limit);
        }
        return limit;
    }

    static spawner(spawn, catalog, spawnlist){
        var canSpawnCritical = false;
        var spawnType = _.findKey(spawnlist.critical, (quota, type)=>{
            if(Spawner.canSpawn(spawn, spawnlist.parts[type], spawnlist.costs[type])){
                return true;
            }else if(spawn.room.energyCapacityAvailable >= spawnlist.costs[type]){
                canSpawnCritical = true;
            }
            return false;
        });

        if(!spawnType && !canSpawnCritical){
            spawnType = _.findKey(spawnlist.spawn, (quota, type)=> Spawner.canSpawn(spawn, spawnlist.parts[type], spawnlist.costs[type]));
        }

        if(spawnType){
            var className = spawnlist.class[spawnType];
            var versionName = spawnlist.version[spawnType];
            var config = classConfig[className];
            var version = config.versions[versionName];
            var spawned = spawn.createCreep(spawnlist.parts[spawnType], spawnType+'-'+Memory.uid, Spawner.prepareSpawnMemory(config, version, spawnType, className, versionName));
            Memory.uid++;
            var current = _.size(catalog.creeps.type[spawnType]);
            console.log(spawn.name, 'spawning', spawned, spawnlist.costs[spawnType], '-', current + 1, 'of', current + spawnlist.spawn[spawnType]);
            return spawned;
        }
        return false;
    }

    static canSpawn(spawn, parts, cost){
        return spawn.room.energyAvailable >= cost && spawn.canCreateCreep(parts) == OK;
    }

    static prepareSpawnMemory(config, version, fullType, className, versionName){
        var memory = {
            class: className,
            type: fullType,
            version: versionName,
            jobId: false,
            jobType: false,
            jobAllocation: 0,
            rules: version.rules || config.rules,
            actions: version.actions || config.actions
        };

        if(version.boost){
            memory.boost = _.keys(version.boost);
        }

        var optMemory = version.memory || config.memory;
        if(optMemory){
            _.assign(memory, optMemory);
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

    static resetBehavior(catalog){
        var classConvert = {
            keepminer: 'miner',
            keepfighter: 'fighter',
            tender: 'hauler'
        }
        var classFallback = {
            miner: 'milli',
            hauler: 'micro',
            worker: 'repair',
            healer: 'pico',
            fighter: 'melee'
        }
        _.forEach(Game.creeps, creep=>{
            var newClass = _.get(classConvert, creep.memory.class, creep.memory.class);
            var newVer = creep.memory.version;
            var config = _.get(classConfig, newClass, false);
            if(!config){
                console.log('failed to find class', creep.memory.class, creep);
                return;
            }
            var version = _.get(config, ['versions', creep.memory.version], false);
            if(!version){
                newVer = classFallback[newClass];
                version = _.get(config, ['versions', newVer], false);
                if(!version){
                    console.log('failed to find version', creep.memory.version);
                    return;
                }
                console.log('converting from', creep.memory.version, 'to', newVer, creep);
            }
            creep.memory.version = newVer;
            creep.memory.type = newVer + newClass;
            creep.memory.class = newClass;
            creep.memory.rules = version.rules || config.rules;
            creep.memory.actions = version.actions || config.actions;
            creep.memory.jobId = false;
            creep.memory.jobType = false;
            creep.memory.jobAllocation = 0;
            var optMemory = version.memory || config.memory;
            if(optMemory){
                _.assign(creep.memory, optMemory);
            }
        });
        Memory.resetBehavior = false;
        console.log("Reset behavior!");
    }
}


module.exports = Spawner;