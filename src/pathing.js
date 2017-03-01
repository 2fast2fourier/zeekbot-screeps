"use strict";

class Pathing {

    static posToSec(pos){
        let x = Math.floor(pos.x / 16.1);
        let y = Math.floor(pos.y / 16.1);
        return {
            x,
            y,
            room: pos.roomName,
            id: pos.roomName + '-'+x+'-'+y
        }
    }

    static secToPos(sec){
        return new RoomPosition(Math.ceil(sec.x * 16.1) + 8, Math.ceil(sec.y * 16.1) + 8, sec.room)
    }

    static getMinPathDistance(start, end){
        if(start.roomName == end.roomName){
            return 0;
        }
        let startSec = Pathing.posToSec(start);
        let pathName = startSec.id;
        let targetMem = Memory.cache.path[end.roomName];
        if(!targetMem){
            targetMem = {};
            Memory.cache.path[end.roomName] = targetMem;
        }
        let distance = targetMem[pathName];
        if(_.isUndefined(distance)){
            let result = Pathing.generatePath(start, new RoomPosition(25, 25, end.roomName), { debug: true, range: 20 });
            distance = _.size(result.path);
            targetMem[pathName] = distance;
        }
        return distance;
    }
    
    static generatePath(start, end, opts){
        let weights = opts.weights || { plainCost: 2, swampCost: 10, roadCost: 1 };
        let result = PathFinder.search(start, { pos: end, range: (opts.range || 1) }, {
            plainCost: weights.plainCost,
            swampCost: weights.swampCost,
            roomCallback: function(roomName) {
                let room = Game.rooms[roomName];
                if (!room) return;
                let costs = new PathFinder.CostMatrix();
                for(let structure of room.find(FIND_STRUCTURES)){
                    if (structure.structureType === STRUCTURE_ROAD) {
                        costs.set(structure.pos.x, structure.pos.y, weights.roadCost);
                    } else if (structure.structureType !== STRUCTURE_CONTAINER && 
                              (structure.structureType !== STRUCTURE_RAMPART || !structure.my)) {
                        costs.set(structure.pos.x, structure.pos.y, 0xff);
                    }
                }
                for(let site of room.find(FIND_MY_CONSTRUCTION_SITES)){
                    if (site.structureType === STRUCTURE_ROAD) {
                        costs.set(site.pos.x, site.pos.y, weights.roadCost);
                    } else if (site.structureType !== STRUCTURE_CONTAINER && 
                              (site.structureType !== STRUCTURE_RAMPART)) {
                        costs.set(site.pos.x, site.pos.y, 0xff);
                    }
                }
                return costs;
            }
        });
        if(opts && opts.debug){
            let visuals = {};
            for(let pos of result.path){
                if(!visuals[pos.roomName]){
                    visuals[pos.roomName] = new RoomVisual(pos.roomName);
                }
                visuals[pos.roomName].rect(pos.x - 0.25, pos.y - 0.25, 0.5, 0.5, { fill: '#2892D7' });
            }
        }
        return result;
    }
}

module.exports = Pathing;