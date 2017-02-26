"use strict";

class Pathing {

    static posToSec(pos){
        let x = Math.floor(pos.x / 12.5);
        let y = Math.floor(pos.y / 12.5);
        return {
            x,
            y,
            room: pos.roomName,
            id: pos.roomName + '-'+x+'-'+y
        }
    }

    static secToPos(sec){
        return new RoomPosition(Math.ceil(sec.x * 12.5) + 6, Math.ceil(sec.y * 12.5) + 6, sec.room)
    }

    static getPathDistance(start, end){
        let startSec = Pathing.posToSec(start);
        let endSec = Pathing.posToSec(end);
        let pathName;
        if(startSec.id < endSec.id){
            pathName = startSec.id+'-'+endSec.id;
        }else{
            pathName = endSec.id+'-'+startSec.id;
        }
        let distance = Memory.cache.path[pathName];
        if(_.isUndefined(distance)){
            let result = Pathing.generatePath(start, Pathing.secToPos(endSec), { debug: true, range: 6 });
            distance = _.size(result.path);
            Memory.cache.path[pathName] = distance;
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