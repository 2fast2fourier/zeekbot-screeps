
const Util = require('./util');

class DefenseMatrix {
    constructor(){
        this.rooms = {};
    }

    startup(){
        _.forEach(Game.rooms, room => {
            var hostiles = room.find(FIND_HOSTILE_CREEPS);
            this.rooms[room.name] = {
                room,
                hostiles,
                damaged: [],
                safemode: _.get(room, 'controller.safeMode', false),
                keeper: false,
                target: _.first(hostiles),
                towers: []
            };
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
                        data.fleeToRange = 5;
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