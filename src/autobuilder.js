"use strict";

function pos2ix(pos){
    return pos.y*50+pos.x;
}

function xy2ix(x, y){
    return y*50+x;
}

function ix2xy(ix, out){
    out[0] = ix % 50;
    out[1] = Math.floor(ix / 50);
}

function ix2pos(ix, roomName){
    return new RoomPosition(ix % 50, Math.floor(ix / 50), roomName);
}


function ix2x(ix){
    return ix % 50;
}

function ix2y(ix){
    return Math.floor(ix / 50);
}

var CLEAR_RANGE = 4;

var cornerpos = [
    [-1, -1],
    [1, 1],
    [1, -1],
    [-1, 1]
];
var rpos = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
];
var doublerpos = [
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2]
];

class AutoBuilder {
    constructor(room){
        this.room = room;
        this.grid = new Array(2500).fill(0);
        this.values = {
            none: 0,
            plain: 1,
            swamp: 2,
            road: 3,
            wall: 4,
            source: 5,
            container: 6,
            spawn: 7,
            extension: 8,
            misc: 9
        }
        this.sources = [];
        this.keys = _.keys(this.values);
        this.vis = new RoomVisual(room.name);
    }

    buildTerrain(){
        var swampStyle = { fill: '#c0ffee' };
        var roomName = this.room.name;
        for(var ix = 1; ix < 49; ix++){
            for(var iy = 1; iy < 49; iy++){
                var terrain = Game.map.getTerrainAt(ix, iy, roomName);
                this.grid[xy2ix(ix, iy)] = this.values[terrain];
                // if(terrain == 'swamp'){
                //     this.vis.circle(ix, iy, swampStyle);
                // }
            }
        }
        this.sources = this.room.find(FIND_SOURCES);
        for(let source of this.sources){
            this.grid[pos2ix(source.pos)] = this.values.source;
            // this.vis.rect(source.pos.x - 1.5, source.pos.y - 1.5, 3, 3, { fill: '#888800' });
        }
        this.structures = this.room.find(FIND_STRUCTURES);
        for(let struct of this.structures){
            let pos = pos2ix(struct.pos);
            this.grid[pos] = Math.max(this.grid[pos], _.get(this.values, struct.structureType, this.values.misc));
            // this.vis.rect(struct.pos.x - 0.4, struct.pos.y - 0.4, 0.8, 0.8, { fill: '#000088' });
            if(struct.structureType == STRUCTURE_SPAWN && !this.spawn){
                this.spawn = struct;
            }
        }
        this.sites = this.room.find(FIND_MY_CONSTRUCTION_SITES);
        for(let struct of this.sites){
            this.grid[pos2ix(struct.pos)] = _.get(this.values, struct.structureType, this.values.misc);
        }
    }

    generateBuildingList(){
        var extensions = [];
        if(this.spawn){
            var out = new Set();
            this.placeExtensions(this.spawn.pos.x, this.spawn.pos.y, 0, new Set(), doublerpos, out);
            extensions = _.sortBy([...out], extension => this.spawn.pos.getRangeTo(ix2pos(extension, this.room.name)));
        }
        return {
            containers: [...this.placeContainers()],
            roads: [...this.placeSpawnRoads()],
            extensions
        }
    }

    addWeights(x, y, minX, maxX, minY, maxY, weights){
        var pos = xy2ix(x, y);
        for(var iy = Math.max(y - 1, minY); iy <= Math.min(y + 1, maxY); iy++){
            for(var ix = Math.max(x - 1, minX); ix <= Math.min(x + 1, maxX); ix++){
                var target = this.grid[xy2ix(ix, iy)];
                if(target < CLEAR_RANGE){
                    weights[pos] = _.get(weights, pos, 0) + 1;
                }
            }
        }
    }

    placeContainers(){
        var containerPos = new Set();
        var pos = 0;
        for(let source of this.sources){
            var weights = {};
            var minX = source.pos.x - 1;
            var maxX = source.pos.x + 1;
            var minY = source.pos.y - 1;
            var maxY = source.pos.y + 1;
            for(var y = minY; y <= maxY; y++){
                for(var x = minX; x <= maxX; x++){
                    if(y != source.pos.y || x != source.pos.x){
                        pos = xy2ix(x, y);
                        if(this.grid[pos] < CLEAR_RANGE){
                            this.addWeights(x, y, minX, maxX, minY, maxY, weights);
                        }
                    }
                }
            }
            let target = false;
            let max = 0;
            _.forEach(weights, (weight, pos) => {
                if(weight > max){
                    target = pos;
                    max = weight;
                }
            });
            if(target){
                this.vis.circle(ix2x(target), ix2y(target), { fill: '#ff0000' });
                containerPos.add(target);
            }
        }
        return containerPos;
    }

    addRoadsAround(struct, roads, radius){
        for(var iy = Math.max(struct.pos.y - radius, 1); iy <= Math.min(struct.pos.y + radius, 48); iy++){
            for(var ix = Math.max(struct.pos.x - radius, 1); ix <= Math.min(struct.pos.x + radius, 48); ix++){
                var pos = xy2ix(ix, iy);
                var target = this.grid[pos];
                if(target < 3 && (ix != struct.pos.x || iy != struct.pos.y)){
                    roads.add(pos);
                }
            }
        }
    }

    placeSpawnRoads(){
        var roads = new Set();
        for(let struct of this.structures){
            if(struct.structureType == STRUCTURE_SPAWN || struct.structureType == STRUCTURE_STORAGE){
                this.addRoadsAround(struct, roads, 1);
            }
            if(struct.structureType == STRUCTURE_CONTROLLER){
                this.addRoadsAround(struct, roads, 2);
            }
            if(struct.structureType == STRUCTURE_EXTENSION){
                for(let pos of rpos){
                    var target = xy2ix(struct.pos.x + pos[0], struct.pos.y + pos[1]);
                    if(this.grid[target] < 3){
                        roads.add(target);
                    }
                }
            }
        }
        for(let source of this.sources){
            this.addRoadsAround(source, roads, 2);
        }
        for(let road of roads){
            this.vis.rect(ix2x(road) - 0.25, ix2y(road) - 0.25, 0.5, 0.5, { fill: '#999999', opacity: 0.25 });
        }
        return roads;
    }

    hasSidesClear(x, y){
        var result = true;
        var current = this.grid[xy2ix(x, y)];
        if(current == this.values.extension){
            return true;
        }
        if(current < CLEAR_RANGE){
            for(let pos of rpos){
                var ix = x + pos[0];
                var iy = y + pos[1];
                var target = this.grid[xy2ix(ix, iy)];
                if(target >= CLEAR_RANGE){
                    result = false;
                }
            }
        }else{
            result = false;
        }
        return result;
    }

    placeExtensions(x, y, count, exhausted, distanceList, output){
        var current = xy2ix(x, y);
        if(count > 5 || exhausted.has(current) || x < 5 || y < 5 || x > 45 || y > 45){
            return;
        }
        exhausted.add(current);
        for(let pos of distanceList){
            var dx = x + pos[0];
            var dy = y + pos[1];
            var target = xy2ix(dx, dy);
            if(this.hasSidesClear(dx, dy)){
                if(this.grid[target] != this.values.extension && !exhausted.has(target) && !output.has(target) && this.spawn.pos.getRangeTo(new RoomPosition(dx, dy, this.room.name)) > 1){
                    output.add(target);
                    count++;
                    this.vis.rect(dx - 0.25, dy - 0.25, 0.5, 0.5, { fill: '#00ff00', opacity: 0.25 });
                }
                this.placeExtensions(dx, dy, count, exhausted, cornerpos, output);
            }
        }
    }

    autobuild(structs){
        if(structs.roads.length > 0){
            structs.roads.forEach((ix)=>{
                let targetPos = ix2pos(ix, this.room.name);
                targetPos.createConstructionSite(STRUCTURE_ROAD);
            });
        }
        if(structs.extensions.length > 0 && this.room.getAvailableStructureCount(STRUCTURE_EXTENSION) > 0){
            let targetPos = ix2pos(_.first(structs.extensions), this.room.name);
            console.log('Building extension at', targetPos);
            targetPos.createConstructionSite(STRUCTURE_EXTENSION);
        }
        if(this.room.memory.role == 'harvest' && structs.containers.length > 0 && this.room.getAvailableStructureCount(STRUCTURE_CONTAINER) > 3){
            let targetPos = ix2pos(_.first(structs.containers), this.room.name);
            console.log('Building container at', targetPos);
            targetPos.createConstructionSite(STRUCTURE_CONTAINER);
        }
    }



}

module.exports = AutoBuilder;