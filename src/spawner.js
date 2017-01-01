"use strict";

var classConfig = require('./creeps');

class Spawner {

    static spawn(catalog){
        var start = Game.cpu.getUsed();
        if(Memory.resetBehavior){
            Spawner.resetBehavior(catalog);
        }
        // var spawnlist = Spawner.generateSpawnList(catalog);
        var spawned = false;
        _.forEach(Game.spawns, spawn => {
            spawned = Spawner.processSpawn(spawn, catalog, spawned);
        });
        catalog.profile('spawner', Game.cpu.getUsed() - start);
    }

    static generateSpawnList(catalog){
        var spawnlist = {
            spawn: {},
            critical: {},
            costs: {}
        };
        var allocation = Spawner.calculateQuotaAllocation(catalog);
        // _.forEach(allocation, (allocated, type) => console.log(type, allocated));
        
        _.forEach(classConfig, (config, className)=>{
            _.forEach(config.versions, (version, versionName)=>{
                var type = versionName+className;
                var limit = Spawner.calculateSpawnLimit(catalog, type, version, config);
                var quota = Spawner.calculateRemainingQuota(catalog, type, version, config, allocation);
                if(Math.min(limit, quota) > 0){
                    spawnlist.costs[type] = Spawner.calculateCost(version.parts || config.parts);
                    if(version.critical){
                        spawnlist.critical[type] = Math.min(limit, quota);
                        // console.log('critical spawn', type, limit, quota, spawnlist.costs[type]);
                    }else{
                        // console.log('spawn', type, limit, quota, spawnlist.costs[type]);
                    }
                    spawnlist.spawn[type] = Math.min(limit, quota);
                }
            });
        });
        // _.forEach(spawnlist.costs, (cost, type) => console.log(type, cost));

        return spawnlist;
    }

    static calculateQuotaAllocation(catalog){
        var allocation = {};
        _.forEach(classConfig, (config, className)=>{
            _.forEach(config.versions, (version, versionName)=>{
                var type = versionName+className;
                var quota = version.quota || config.quota;
                if(quota){
                    var jobType = _.isString(quota) ? quota : quota.jobType;
                    var allocate = _.get(version, 'allocation', _.get(quota, 'allocation', 1));
                    _.set(allocation, jobType, _.get(allocation, jobType, 0) + (_.get(catalog.creeps.type, [type, 'length'], 0) * allocate));
                }

            });
        });

        return allocation;
    }

    static calculateRemainingQuota(catalog, type, version, config, allocation){
        var quota = version.quota || config.quota;
        if(quota){
            var jobType = _.isString(quota) ? quota : quota.jobType;
            var capacity = _.get(catalog.jobs.capacity, jobType, 0);
            var creepsNeeded = Math.ceil(capacity/_.get(version, 'allocation', _.get(quota, 'allocation', 1)));
            var existing = Math.ceil(_.get(allocation, jobType, 0)/_.get(version, 'allocation', _.get(quota, 'allocation', 1)));
            // if(type == 'milliminer'){
            //     console.log(jobType, capacity, _.get(allocation, jobType, 0));
            // }
            return Math.min(creepsNeeded, _.get(quota, 'max', Infinity)) - existing;
        }
        return 0;
    }

    static calculateScalingQuota(catalog, type, version, config, allocation){
        var quota = _.get(version, 'ideal', 0);
        var scale = version.scale || config.scale;
        if(scale){
            //TODO make generic stats collection to remove this if-chain
            if(scale.room > 0){
                quota += Math.ceil(scale.room * catalog.rooms.length);
            }
            if(scale.repair > 0){
                quota += Math.ceil(Memory.stats.global.repair / scale.repair);
            }
            if(scale.energy > 0){
                quota += Math.floor(Memory.stats.global.totalEnergy / scale.energy);
            }
        }
        return Math.min(quota, _.get(scale, 'max', Infinity));
    }

    static calculateSpawnLimit(catalog, type, version, config){
        if(version.disable){
            if(version.disable.maxSpawn > 0 && Memory.stats.global.maxSpawn >= version.disable.maxSpawn){
                return 0;
            }
        }
        return Infinity;
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







// nuke this sick code

    static shouldSpawn(spawn, fullType, className, version, catalog, category, roomStats){
        if(!Spawner.checkRequirements(spawn, catalog, category, version, roomStats) ||
            Spawner.checkDisable(spawn, catalog, category, version, roomStats)){
            return false;
        }
        return Spawner.getSpawnCount(spawn, catalog, category, version, roomStats, className, fullType) > 0;
    }

    static getSpawnCount(spawn, catalog, category, version, roomStats, className, fullType){
        var currentCount = Spawner.getCount(catalog, fullType);
        var additional = Spawner.calculateAdditional(category, version, catalog, roomStats);
        var ideal = _.get(version, 'ideal', 0);
        var bootstrap = _.get(version, 'bootstrap', 0);
        var quota = version.quota || category.quota;

        if(quota && quota.jobType && version.quota !== false){
            var needCapacity = _.get(catalog.jobs.capacity, quota.jobType, 0);
            var targetCapacity = Math.ceil(needCapacity * _.get(quota, 'ratio', 1));
            var creepsNeeded = Math.ceil(targetCapacity/_.get(version, 'allocation', _.get(quota, 'allocation', 1)));
            additional += Math.min(creepsNeeded, _.get(quota, 'max', Infinity));
        }

        if(ideal > 0){
            return Math.max(0, ideal + additional - currentCount);
        }else if(bootstrap > 0){
            return Math.max(0, bootstrap + additional - Spawner.getClassCount(catalog, className));
        }else if(additional > 0){
            return Math.max(0, additional - currentCount);
        }
        return 0;
    }

    static calculateAdditional(config, version, catalog, roomStats){
        var count = 0;
        var additional = version.additional || config.additional;

        var additionalPer = version.additionalPer || config.additionalPer;
        if(additionalPer){
            var add = 0;
            if(additionalPer.flagPrefix){
                add += catalog.getFlagsByPrefix(additionalPer.flagPrefix).length * _.get(additionalPer, 'count', 1);
            }
            if(additionalPer.room > 0){
                add += catalog.rooms.length * additionalPer.room;
            }
            if(additionalPer.repair > 0){
                add += Math.ceil(Memory.stats.global.repair / additionalPer.repair);
            }
            if(additionalPer.max > 0){
                count += Math.min(add, additionalPer.max);
            }else{
                count += add;
            }
        }

        if(additional){
            var pass = _.reduce(additional, (result, requirement, name)=>{
                if(name == 'count' || name == 'unless'){
                    return result;
                }
                return result && roomStats[name] > requirement;
            }, true);
            if(pass){
                count += _.get(additional, 'count', 0);
            }else{
                count += _.get(additional, 'unless', 0);
            }
        }
        return count;
    }

    static checkRequirements(spawn, catalog, category, version, roomStats){
        var requirements = version.requirements;
        if(requirements){
            if(requirements.extractor && !roomStats.extractor){
                return false;
            }
            if(requirements.mineralAmount > 0 && roomStats.mineralAmount < requirements.mineralAmount){
                return false;
            }
            if(requirements.energy > 0 && roomStats.energy < requirements.energy){
                return false;
            }
            if(requirements.flag && !Game.flags[requirements.flag]){
                return false;
            }
            if(requirements.repairHits > 0 && requirements.repairHits > roomStats.repairHits){
                return false;
            }
        }
        return true;
    }

    static checkDisable(spawn, catalog, category, version, roomStats){
        var disable = version.disable;
        if(disable){
            if(disable.maxSpawn > 0 && Memory.stats.global.maxSpawn >= disable.maxSpawn){
                return true;
            }
            if(disable.extractor && roomStats.extractor){
                return true;
            }
            if(disable.energy > 0 && roomStats.energy >= disable.energy){
                return true;
            }
            if(disable.flag && !!Game.flags[disable.flag]){
                return true;
            }
            if(disable.terminalEnergy > 0 && disable.terminalEnergy <= roomStats.terminalEnergy){
                return true;
            }
        }
        return false;
    }

    static findCriticalDeficit(spawn, catalog){
        var roomStats = Memory.stats.rooms[spawn.room.name];
        var deficits = {};
        var deficitCount = {};
        _.forEach(classConfig, (config, className) => {
            _.forEach(config.versions, (version, typeName) =>{
                if(version.critical > 0
                        && version.critical <= roomStats.spawn
                        && Spawner.checkRequirements(spawn, catalog, config, version, roomStats)
                        && !Spawner.checkDisable(spawn, catalog, config, version, roomStats)){
                    var count = Spawner.getSpawnCount(spawn, catalog, config, version, roomStats, className, typeName+className);
                    if(count > 0 && !spawn.spawning){
                        deficits[className] = config;
                        deficitCount[className] = count;
                    }
                }
            });
        });
        catalog.spawnDeficit = deficitCount;
        return deficits;
    }

    static prepareSpawnMemory(category, version, fullType, className, versionName, catalog, spawn){
        var memory = {
            class: className,
            type: fullType,
            version: versionName,
            jobId: false,
            jobType: false,
            jobAllocation: 0,
            rules: version.rules || category.rules,
            actions: version.actions || category.actions
        };

        var optMemory = version.memory || category.memory;
        if(optMemory){
            _.assign(memory, optMemory);
        }

        return memory;
    }

    static getCount(catalog, fullType){
        return _.get(catalog.creeps.type, [fullType, 'length'], 0);
    }

    static getClassCount(catalog, classType){
        return _.get(catalog.creeps.class, [classType, 'length'], 0);
    }

    static processSpawn(spawn, catalog, startedSpawn){
        var config = classConfig;
        var deficits = Spawner.findCriticalDeficit(spawn, catalog);
        var roomStats = Memory.stats.rooms[spawn.room.name];
        if(!roomStats){
            Memory.updateTime = 0;
            return;
        }
        if(_.size(deficits) > 0){
            config = deficits;
        }
        _.forEach(config, function(category, className){
            _.forEach(category.versions, function(version, prefix){
                var fullType = prefix + className;
                if(!startedSpawn && !spawn.spawning && Spawner.shouldSpawn(spawn, fullType, className, version, catalog, category, roomStats)){
                    var loadout = Spawner.partList(version.parts);
                    if(spawn.canCreateCreep(loadout) == OK){
                        var spawned = spawn.createCreep(loadout, fullType+'-'+Memory.uid, Spawner.prepareSpawnMemory(category, version, fullType, className, prefix, catalog, spawn));
                        startedSpawn = !!spawned;
                        Memory.uid++;
                        console.log(spawn.name, 'spawning', fullType, 'new count:', Spawner.getCount(catalog, fullType)+1, 'cost:', Spawner.calculateCost(version.parts));
                        //HACK reset deficit count until next tick, so we don't accidentally interrupt any jobs
                        catalog.deficits[className] = 0;
                    }
                }
            });
        });
        return startedSpawn;
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