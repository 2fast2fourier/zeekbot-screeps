'use strict';

const Util = require('../util');
const Pathing = require('../pathing');

const Combat = require('./combat');
const Movement = require('./movement');

let creeps = {};

class Squad {
    static init(){
        creeps = {};

        if(!Memory.squads || !Memory.squads.waves){
            Memory.squads = {
                config: {},
                waves: {}
            }
        }
    }

    static process(){
        Squad.processFlags();

        _.forEach(Memory.squads.waves, Squad.processStart);
    }

    static processStart(wave, squadId){
        var config = Squad.getConfig(wave.config);
        if(!config){
            Squad.endWave(squadId);
            return;
        }
        var creeps = Squad.getCreeps(squadId);
        if(wave.recruiting){
            if(Game.interval(5) && creeps && creeps.length > 0){
                var counts = {};
                for(let creep of creeps){
                    let subtype = creep.memory.jobSubType;
                    if(!counts[subtype]){
                        counts[subtype] = 0;
                    }
                    counts[subtype]++;
                }
                wave.recruiting = !_.all(wave.units, (ideal, type) => ideal <= counts[type]);
                if(!wave.recruiting){
                    console.log('Wave finished recruiting:', squadId);
                }
            }
        }else{
            if(!creeps || creeps.length == 0){
                console.log('No creeps left, ending wave!', squadId);
                Squad.endWave(squadId);
                return;
            }
        }
        if(creeps && creeps.length > 0){
            // console.log(creeps);
            var waypoint = Squad.getWaypoint(squadId, wave, config);
            if(waypoint){
                var arrived = true;
                for(let creep of creeps){
                    var dist = creep.pos.getRangeTo(waypoint);
                    if(dist > 3){
                        Pathing.attackMove(creep, { pos: waypoint }, 3);
                        arrived = false;
                    }
                }
                if(arrived && !wave.recruiting){
                    console.log(squadId, 'Arrived at waypoint:', waypoint);
                    if((wave.waypoint + 1) < config.waypoints.length){
                        wave.waypoint++;
                        console.log(squadId, 'Moving to next waypoint...');
                    }else{
                        wave.waypoint = false;
                        console.log(squadId, 'Reached final waypoint!');
                    }
                }
            }
        }
    }

    static processFlags(){
        var flags = Flag.prefix.squad;
        if(flags){
            for(var flag of flags){
                let id = flag.parts[2];
                let arg = flag.parts[3];
                let arg2 = flag.parts[4];
                let flagCluster = Game.clusterForRoom(flag.pos.roomName);
                if(!id){
                    console.log('Squad flag missing argument!', flag.name);
                    flag.remove();
                    continue;
                }
                switch(flag.parts[1]){
                    case 'config':
                        console.log('Added new squad config:', id);
                        Squad.addConfig(id);
                        break;
                    case 'delete':
                        console.log('Removed squad config:', id);
                        Squad.removeConfig(id);
                        break;
                    case 'spawn':
                        //squad-spawn-patrol-attack-1
                        if(!arg || !arg2 || !flagCluster){
                            console.log('Missing arguments!', flag.name);
                        }else{
                            console.log('Added squad units:', id, arg, arg2, 'spawning from', flagCluster.id);
                            Squad.addSpawn(id, arg, _.parseInt(arg2), flagCluster.id);
                        }
                        break;
                    case 'start':
                        Squad.spawnWave(id);
                        break;
                    case 'end':
                        Squad.endWave(id);
                        break;
                    case 'endall':
                        _.forEach(Memory.squads.waves, (wave, squadId) => {
                            if(wave.config == id){
                                Squad.endWave(id);
                            }
                        });
                        break;
                    case 'waypoint':
                        if(arg == 'clear'){
                            Squad.clearWaypoints(id);
                        }else if(arg == 'remove'){
                            Squad.removeWaypointsInRoom(id, flag.pos.roomName);
                        }else if(arg == 'set'){
                            Squad.setWaypoint(id, _.parseInt(arg2), flag.pos);
                        }else{
                            Squad.addWaypoint(id, flag.pos);
                        }
                        break;
                }
                flag.remove();
            }
        }
    }

    static addConfig(configId){
        Memory.squads.config[configId] = {
            units: {},
            waypoints: [],
            uid: 1
        };
    }

    static removeConfig(configId){
        delete Memory.squads.config[configId];
        Memory.squads.waves = _.pick(Memory.squads.waves, squad => squad.config != configId);
    }

    static addSpawn(configId, type, count, clusterId){
        var config = Squad.getConfig(configId);
        if(!config || !Game.clusters[clusterId]){
            console.log('Invalid config!', configId, clusterId);
            return;
        }
        if(!config.units[clusterId]){
            config.units[clusterId] = {};
        }
        config.units[clusterId][type] = count;
        _.forEach(Memory.squads.waves, (squad, squadId) => {
            if(Squad.isRecruiting(squadId)){
                Squad.updateUnitList(squadId);
            }
        });
    }

    static addWaypoint(configId, pos){
        var config = Squad.getConfig(configId);
        if(config){
            config.waypoints.push({
                pos: pos.str
            });
            console.log(configId, 'Added waypoint:', pos.str);
        }
    }

    static setWaypoint(configId, num, pos){
        var config = Squad.getConfig(configId);
        if(config){
            if(config.waypoints[num]){
                var oldPos = config.waypoints[num].pos;
                config.waypoints[num] = {
                    pos: pos.str
                };
                console.log(configId, 'Replaced waypoint', num, oldPos);
            }else{
                Squad.addWaypoint(configId, pos);
            }
        }
    }

    static removeWaypointsInRoom(configId, roomName){
        var config = Squad.getConfig(configId);
        if(config){
            config.waypoints = _.filter(config.waypoints, waypoint => waypoint.pos.roomName != roomName);
        }
    }

    static clearWaypoints(configId){
        var config = Squad.getConfig(configId);
        if(config){
            config.waypoints = {};
            _.forEach(Memory.squads.waves, wave => {
                if(wave.config == configId){
                    wave.waypoint = 0;
                }
            });
        }
    }

    static getConfig(configId){
        return Memory.squads.config[configId];
    }

    static spawnWave(configId){
        var config = Squad.getConfig(configId);
        if(!config){
            console.log('Invalid squad config!', configId);
            return;
        }
        var squadId = configId + '-wave-' + config.uid;
        config.uid++;
        Memory.squads.waves[squadId] = {
            id: squadId,
            config: configId,
            units: {},
            spawn: config.units,
            recruiting: true,
            waypoint: 0
        };
        Squad.updateUnitList(squadId);
        console.log('Spawning wave:', squadId);
    }

    static isValid(squadId){
        return Squad.getSquad(squadId) != undefined;
    }

    static isRecruiting(squadId){
        return Squad.getSquad(squadId).recruiting;
    }

    static isActive(squadId){
        return !Squad.getSquad(squadId).recruiting;
    }

    static getSquad(squadId){
        return Memory.squads.waves[squadId];
    }

    static getAllSquads(){
        return Memory.squads.waves;
    }

    static getActiveSquads(){
        return _.pick(Memory.squads.waves, wave => !wave.recruiting);
    }

    static getRecruitingSquads(){
        return _.pick(Memory.squads.waves, wave => wave.recruiting);
    }

    static endWave(squadId){
        delete Memory.squads.waves[squadId];
    }

    static registerCreep(squadId, creep){
        if(!creeps[squadId]){
            creeps[squadId] = [];
        }
        creeps[squadId].push(creep);
    }

    static getCreeps(squadId){
        return creeps[squadId] || [];
    }

    static getWaypoint(squadId, wave, config){
        if(wave.waypoint === false){
            return;
        }
        var data = config.waypoints[wave.waypoint];
        if(data){
            return RoomPosition.fromStr(data.pos);
        }
    }

    static updateQuotaAllocations(cluster){
        _.forEach(creeps, (list, squadId)=>{
            if(!Squad.isRecruiting(squadId)){
                for(let creep of list){
                    creep.memory.quotaAlloc = 0;
                }
            }
        });
    }

    static updateUnitList(squadId){
        var squad = Squad.getSquad(squadId);
        var config = Squad.getConfig(squad.config);
        var units = _.reduce(config.units, (result, clusterUnits) => {
            return _.forEach(clusterUnits, (count, type)=>{
                _.set(result, type, _.get(result, type, 0) + count);
            });
        }, {});
        squad.spawn = config.units;
        squad.units = units;
    }
}

module.exports = Squad;