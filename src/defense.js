
const Util = require('./util');

const whitelist = [
    'likeafox'
];

const partValues = {
    heal: HEAL_POWER,
    attack: ATTACK_POWER,
    ranged_attack: RANGED_ATTACK_POWER,
    work: DISMANTLE_POWER
};

const boostTypes = {
    heal: 'heal',
    attack: 'attack',
    ranged_attack: 'rangedAttack',
    work: 'dismantle'
}

class DefenseMatrix {
    constructor(){
        this.rooms = {};
    }

    static getOwnerType(creep){
        if(creep.my){
            return 'mine';
        }
        if(!creep.owner){
            Game.notify('Invalid owner: ' + JSON.stringify(creep));
            console.log('Invalid owner: ' + JSON.stringify(creep));
            return 'friendly';
        }
        var owner = creep.owner.username;
        if(owner == 'likeafox' || owner == 'Vlahn' || owner == 'NobodysNightmare' || owner == 'xaq'){
            return 'friendly';
        }
        if(owner == 'Source Keeper'){
            return 'keeper';
        }
        if(owner == 'Invader'){
            return 'invader';
        }
        return 'player';
    }

    static characterize(totals, armed, creep){
        var ownerType = DefenseMatrix.getOwnerType(creep);
        var details = {
            attack: 0,
            heal: 0,
            ranged_attack: 0,
            work: 0,
            ownerType,
            hostile: !creep.my && ownerType != 'friendly' && ownerType != 'keeper'
        };
        for(let part of creep.body){
            if(part.hits > 0){
                if(part.type == 'attack' || part.type == 'heal' || part.type == 'ranged_attack' || part.type == 'work'){
                    var multi = 1;
                    if(part.boost){
                        multi = _.get(BOOSTS, [part.type, part.boost, boostTypes[part.type]], 1);
                    }
                    details[part.type] += partValues[part.type] * multi;
                }
            }
        }
        if(details.attack > 0 || details.ranged_attack > 0){
            armed.push(creep);
        }
        creep.details = details;
        var typeData = totals[ownerType];
        if(!typeData){
            typeData = {
                attack: 0,
                heal: 0,
                ranged_attack: 0,
                work: 0,
                count: 0
            };
            totals[ownerType] = typeData;
        }
        typeData.attack += details.attack;
        typeData.heal += details.heal;
        typeData.ranged_attack += details.ranged_attack;
        typeData.work += details.work;
        typeData.count++;

        totals.attack += details.attack;
        totals.heal += details.heal;
        totals.ranged_attack += details.ranged_attack;
        totals.work += details.work;
        totals.count++;
        return ownerType;
    }

    static isSiegeMode(creeps, totals){
        return creeps.player
            && creeps.player.length > 0
            && totals.player
            && totals.player.heal > 200;
    }

    startup(){
        Game.perf();
        _.forEach(Game.rooms, room => {
            var hostiles = room.find(FIND_HOSTILE_CREEPS);
            var totals = {
                attack: 0,
                heal: 0,
                ranged_attack: 0,
                work: 0,
                count: 0
            };
            var creeps;
            var enemy;
            var armed = [];
            if(hostiles.length > 0){
                creeps = _.groupBy(hostiles, DefenseMatrix.characterize.bind(null, totals, armed));
                enemy = _.filter(hostiles, 'details.hostile');
            }else{
                enemy = [];
                creeps = {};
            }
            var data = {
                room,
                armed,
                hostiles: enemy,
                damaged: [],
                safemode: _.get(room, 'controller.safeMode', false),
                keeper: room.memory.keep,
                keeps: [],
                target: _.first(enemy),
                towers: [],
                creeps,
                underSiege: DefenseMatrix.isSiegeMode(creeps, totals),
                total: totals,
                targetted: false
            };
            if(room.memory.keep){
                data.keeps = _.filter(room.find(FIND_HOSTILE_STRUCTURES), keep => keep.ticksToSpawn < 10);
                if(creeps.keeper){
                    data.avoid = data.keeps.concat(creeps.keeper);
                }else{
                    data.avoid = data.keeps;
                }
            }else if(room.memory.role == 'core'){
                data.avoid = enemy;
            }else{
                data.avoid = [];
            }
            if(data.underSiege && (room.memory.defend || room.memory.tripwire)){
                var message = 'Warning: Player creeps detected in our territory: ' + room.name + ' - ' + _.get(data.creeps, 'player[0].owner.username', 'Unknown');
                Game.note('playerWarn'+room.name, message);
                if(room.cluster){
                    room.cluster.state.defcon = Game.time + 500;
                }
            }
            this.rooms[room.name] = data;
        });
        _.forEach(Game.creeps, creep => {
            if(creep.hits < creep.hitsMax){
                this.rooms[creep.room.name].damaged.push(creep);
            }
        });
        if(Flag.prefix.defend){
            for(var flag of Flag.prefix.defend){
                var cluster = Game.clusterForRoom(flag.pos.roomName);
                if(cluster && flag.parts.length > 1){
                    if(!cluster.defense.hardpoints){
                        cluster.defense.hardpoints = {};
                    }
                    if(flag.parts[1] == 'remove'){
                        delete cluster.defense.hardpoints[flag.pos.str];
                        console.log('Removed defend order:', flag.pos, flag.parts[1]);
                    }else{
                        cluster.defense.hardpoints[flag.pos.str] = {
                            type: flag.parts[1],
                            pos: flag.pos
                        };
                        console.log('Defending:', flag.pos, flag.parts[1]);
                    }
                    flag.remove();
                }
            }
        }

        Game.perf('matrix');
    }

    process(cluster){
        _.forEach(cluster.structures.tower, tower => {
            if(tower.energy >= 10){
                this.rooms[tower.pos.roomName].towers.push(tower);
            }
        });
        var remaining = cluster.state.defcon - Game.time;
        var tickMessage = 'DEFCON: ' + remaining;
        _.forEach(cluster.rooms, room => {
            let data = this.rooms[room.name];
            if(data.hostiles.length > 0 && room.memory.role != 'core'){
                let nearest = cluster.findNearestRoomByRole(room, 'core');
                if(nearest){
                    let roomData = Memory.rooms[nearest.room.name];
                    if(roomData && roomData.gather){
                        data.fleeTo = new RoomPosition(roomData.gather.x, roomData.gather.y, roomData.gather.roomName);
                        data.fleeToRange = 3;
                    }else{
                        data.fleeTo = new RoomPosition(25, 25, nearest.room.name);
                        data.fleeToRange = 15;
                    }
                }
            }
            if(remaining > 0){
                room.visual.text(tickMessage, 25, 25);
            }
        });
        if(Game.intervalOffset(10, 5)){
            cluster.defense.longbow = {};
            cluster.defense.rampart = {};
            if(cluster.state.defcon > Game.time && cluster.defense.hardpoints){
                for(let id in cluster.defense.hardpoints){
                    let data = cluster.defense.hardpoints[id];
                    cluster.defense[data.type][id] = {
                        id,
                        pos: data.pos
                    };
                }
            }
        }
    }

    helpers(){
        let flags = Flag.getByPrefix('tower');
        for(let flag of flags){
            if(flag.room){
                flag.room.visual.rect(flag.pos.x - 5.5, flag.pos.y - 5.5, 11, 11, {
                    fill: '#ff0000',
                    opacity: 0.1
                });
                flag.room.visual.rect(flag.pos.x - 10.5, flag.pos.y - 10.5, 21, 21, {
                    fill: '#ff0000',
                    opacity: 0.1
                });
                flag.room.visual.rect(flag.pos.x - 20.5, flag.pos.y - 20.5, 41, 41, {
                    fill: '#ff0000',
                    opacity: 0.1
                });
            }
        }
        if(Game.flags.clearTower){
            flags.forEach(flag => flag.remove());
            Game.flags.clearTower.remove();
        }
    }
}

module.exports = DefenseMatrix;