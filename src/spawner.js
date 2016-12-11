"use strict";

var classConfig = require('./creeps');
// var behaviors = require('./behaviors');

class Spawner {

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

        if(quota && quota.jobType){
            var needCapacity = _.get(catalog.jobs.capacity, quota.jobType, 0);
            var targetCapacity = needCapacity * _.get(quota, 'ratio', 1);
            var creepsNeeded = Math.ceil(targetCapacity/_.get(quota, 'allocation', 1));
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

        //TODO nuke this
        var additionalPer = version.additionalPer || config.additionalPer;
        if(additionalPer){
            if(additionalPer.flagPrefix){
                count += catalog.getFlagsByPrefix(additionalPer.flagPrefix).length;
            }
        }
        //END TODO

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
                return false
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
            if(requirements.flagClear > 0 && !!Game.flags[requirements.flag]){
                var flag = Game.flags[requirements.flag];
                if(!flag.room){
                    return false;
                }
                var hostiles = _.filter(catalog.getHostileCreeps(flag.room), hostile => flag.pos.getRangeTo(hostile) < requirements.flagClear);
                if(hostiles.length > 0){
                    return false;
                }
            }
        }
        return true;
    }

    static checkDisable(spawn, catalog, category, version, roomStats){
        var disable = version.disable;
        if(disable){
            if(disable.spawnCapacity > 0 && roomStats.spawn >= disable.spawnCapacity){
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
            rules: version.rules || category.rules
        };

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

    static spawn(catalog){
        if(!Memory.uid){
            Memory.uid = 1;
        }
        if(Memory.resetBehavior){
            Spawner.resetBehavior(catalog);
        }
        var spawned = false;
        _.forEach(Game.spawns, spawn => {
            spawned = Spawner.processSpawn(spawn, catalog, spawned);
        });
    }

    static resetBehavior(catalog){
        _.forEach(Game.creeps, creep=>{
            var config = _.get(classConfig, creep.memory.class, false);
            var version = _.get(config, ['versions', creep.memory.version], false);
            if(!config || !version){
                console.log('could not find config', creep);
                return;
            }
            creep.memory.rules = version.rules || config.rules;
            creep.memory.jobId = false;
            creep.memory.jobType = false;
            creep.memory.jobAllocation = 0;
        });
        Memory.resetBehavior = false;
        console.log("Reset behavior!");
    }
}


module.exports = Spawner;