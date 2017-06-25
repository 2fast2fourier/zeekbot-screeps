
const Util = require('./util');

const whitelist = [
    'likeafox'
];

const partValues = {
    heal: HEAL_POWER,
    attack: ATTACK_POWER,
    rangedAttack: RANGED_ATTACK_POWER,
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
            Game.notify('Invalid owner: '+creep);
            return 'friendly';
        }
        var owner = creep.owner.username;
        if(owner == 'likeafox'){
            return 'friendly';
        }
        // hostiles.push(creep);
        if(owner == 'Source Keeper'){
            return 'keeper';
        }
        if(owner == 'Invader'){
            return 'invader';
        }
        return 'player';
    }

    static characterize(creep){
        var ownerType = DefenseMatrix.getOwnerType(creep);
        var details = {
            attack: 0,
            heal: 0,
            ranged_attack: 0,
            work: 0,
            ownerType,
            hostile: !creep.my && ownerType != 'friendly'
        };
        for(let part in creep.body){
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
        creep.details = details;
        return ownerType;
    }

    static isSiegeMode(creeps){
        return true;
    }

    startup(){
        _.forEach(Game.rooms, room => {
            var hostiles = room.find(FIND_HOSTILE_CREEPS);
            var threats = {};
            var creeps = _.groupBy(hostiles, DefenseMatrix.characterize);
            var enemy = _.filter(hostiles, 'details.hostile');
            this.rooms[room.name] = {
                room,
                hostiles: enemy,
                damaged: [],
                safemode: _.get(room, 'controller.safeMode', false),
                keeper: false,
                target: _.first(enemy),
                towers: [],
                creeps,
                siege: DefenseMatrix.isSiegeMode(creeps),
                threat: threats,
                targetted: false
            };
            if(creeps.player && room.defend){
                Game.note('playerWarn', 'Warning: Player creeps detected in our territory: ' + room.name);
            }
        });
        _.forEach(Game.creeps, creep => {
            if(creep.hits < creep.hitsMax){
                this.rooms[creep.room.name].damaged.push(creep);
            }
        });
    }

    process(cluster){
        _.forEach(cluster.structures.tower, tower => {
            if(tower.energy >= 10){
                this.rooms[tower.pos.roomName].towers.push(tower);
            }
        });
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
        });
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