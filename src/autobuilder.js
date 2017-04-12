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
            storage: 9,
            link: 10,
            misc: 11
        }
        this.buildings = {};
        this.sources = [];
        this.keys = _.keys(this.values);
        this.vis = new RoomVisual(room.name);
    }

    static processRoadFlags(){
        if(Game.flags.roadStart && Game.flags.roadEnd){
            let built = AutoBuilder.buildRoads(Game.flags.roadStart.pos, Game.flags.roadEnd.pos);
            if(built == 0){
                Game.flags.roadStart.remove();
                Game.flags.roadEnd.remove();
            }
        }
        if(Game.flags.harvestRoad || Game.flags.harvestRoadDebug){
            let flag = Game.flags.harvestRoad || Game.flags.harvestRoadDebug;
            let room = flag.room;
            if(room && room.hasCluster()){
                let storage = AutoBuilder.findNearest(room.getCluster(), flag.pos, STRUCTURE_STORAGE);
                if(storage){
                    let remaining = AutoBuilder.buildRoads(flag.pos, storage.pos, flag.name.indexOf('Debug') >= 0);
                    if(remaining == 0){
                        flag.remove();
                    }
                }
            }
        }
    }

    static findNearest(cluster, pos, type){
        return  _.first(_.sortBy(cluster.structures[type], struct => pos.getLinearDistance(struct)));
    }

    static buildInfrastructureRoads(cluster){
        if(cluster.structures.storage.length > 0 && _.size(Game.constructionSites) < 20){
            for(let source of cluster.findAll(FIND_SOURCES)){
                let storage = AutoBuilder.findNearest(cluster, source.pos, STRUCTURE_STORAGE);
                if(storage){
                    AutoBuilder.buildRoads(source.pos, storage.pos);
                }
            }
            for(let extractor of cluster.getAllStructures([STRUCTURE_EXTRACTOR, STRUCTURE_CONTROLLER])){
                let storage = AutoBuilder.findNearest(cluster, extractor.pos, STRUCTURE_STORAGE);
                if(storage){
                    AutoBuilder.buildRoads(extractor.pos, storage.pos);
                }
            }
        }
    }

    static buildRoads(start, end, debug){
        let visuals = {};
        visuals[start.roomName] = new RoomVisual(start.roomName);
        let result = PathFinder.search(start, { pos: end, range: 1 }, {
            plainCost: 2,
            swampCost: 2,
            roomCallback: function(roomName) {
                let room = Game.rooms[roomName];
                if (!room) return;
                let costs = new PathFinder.CostMatrix();
                for(let structure of room.find(FIND_STRUCTURES)){
                    if (structure.structureType === STRUCTURE_ROAD) {
                        costs.set(structure.pos.x, structure.pos.y, 1);
                    } else if (structure.structureType !== STRUCTURE_CONTAINER && 
                              (structure.structureType !== STRUCTURE_RAMPART || !structure.my)) {
                        costs.set(structure.pos.x, structure.pos.y, 0xff);
                    }
                }
                for(let site of room.find(FIND_MY_CONSTRUCTION_SITES)){
                    if (site.structureType === STRUCTURE_ROAD) {
                        costs.set(site.pos.x, site.pos.y, 1);
                    } else if (site.structureType !== STRUCTURE_CONTAINER && 
                              (site.structureType !== STRUCTURE_RAMPART)) {
                        costs.set(site.pos.x, site.pos.y, 0xff);
                    }
                }
                return costs;
            }
        });
        let remaining = _.size(result.path);
        for(let pos of result.path){
            if(pos.x == 0 || pos.x == 49 || pos.y == 0 || pos.y == 49){
                remaining--;
                continue;
            }
            if(!visuals[pos.roomName]){
                visuals[pos.roomName] = new RoomVisual(pos.roomName);
            }
            visuals[pos.roomName].rect(pos.x - 0.25, pos.y - 0.25, 0.5, 0.5, { fill: '#2892D7' });
            if(!debug && Game.rooms[pos.roomName]){
                let construct = pos.createConstructionSite(STRUCTURE_ROAD);
                if(construct == OK || construct == ERR_INVALID_TARGET){
                    remaining--;
                }
            }
        }
        return remaining;
    }

    buildTerrain(){
        var swampStyle = { fill: '#c0ffee' };
        var roomName = this.room.name;
        for(var ix = 1; ix < 49; ix++){
            for(var iy = 1; iy < 49; iy++){
                var terrain = Game.map.getTerrainAt(ix, iy, roomName);
                this.grid[xy2ix(ix, iy)] = this.values[terrain];
            }
        }
        this.sources = this.room.find(FIND_SOURCES);
        for(let source of this.sources){
            this.grid[pos2ix(source.pos)] = this.values.source;
        }
        this.structures = this.room.find(FIND_STRUCTURES);
        for(let struct of this.structures){
            if(struct.structureType != 'road'){
                if(!this.buildings[struct.structureType]){
                    this.buildings[struct.structureType] = [];
                }
                this.buildings[struct.structureType].push(struct);
            }
            let pos = pos2ix(struct.pos);
            this.grid[pos] = Math.max(this.grid[pos], _.get(this.values, struct.structureType, this.values.misc));
            if(struct.structureType == STRUCTURE_SPAWN && !this.spawn){
                this.spawn = struct;
            }
        }
        this.sites = this.room.find(FIND_MY_CONSTRUCTION_SITES);
        for(let struct of this.sites){
            this.grid[pos2ix(struct.pos)] = _.get(this.values, struct.structureType, this.values.misc);
        }
    }

    countNearby(gridTypes, idx, radius){
        var count = 0;
        var x = ix2x(idx);
        var y = ix2y(idx);
        for(let iy = Math.max(1, y - radius); iy <= Math.min(48, y + radius); iy++){
            var xoff = iy * 50;
            for(let ix = Math.max(1, x - radius); ix <= Math.min(48, x + radius); ix++){
                if(gridTypes.includes(this.grid[xoff + ix])){
                    count++;
                }
                // this.vis.rect(ix - 0.25, iy - 0.25, 0.5, 0.5, { fill: '#ff0000', opacity: 0.25 });
            }
        }
        return count;
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
            roads: [...this.placeRoads()],
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

    findAccessibleSpot(origin, radius){
        var weights = {};
        var minX = Math.max(1, origin.x - radius);
        var maxX = Math.min(48, origin.x + radius);
        var minY = Math.max(1, origin.y - radius);
        var maxY = Math.min(48, origin.y + radius);
        for(var y = minY; y <= maxY; y++){
            for(var x = minX; x <= maxX; x++){
                if(y != origin.y || x != origin.x){
                    let pos = xy2ix(x, y);
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
        return target;
    }

    placeContainers(){
        var containerPos = new Set();
        var pos = 0;
        var sources = this.sources;
        if(this.room.memory.role == 'core' || this.room.memory.keep){
            sources = sources.concat(this.room.find(FIND_MINERALS) || []);
        }
        for(let source of sources){
            if(this.countNearby([this.values.container, this.values.storage, this.values.link], pos2ix(source.pos), 2) > 0){
                continue;
            }
            let target = this.findAccessibleSpot(source.pos, 1);
            if(target){
                this.vis.circle(ix2x(target), ix2y(target), { fill: '#ff0000' });
                containerPos.add(target);
            }
        }
        if(this.room.controller && this.room.memory.role == 'core'){
            let pos = this.room.controller.pos;
            if(this.countNearby([this.values.container, this.values.storage, this.values.link], pos2ix(pos), 2) == 0){
                let target = this.findAccessibleSpot(pos, 2);
                if(target){
                    this.vis.circle(ix2x(target), ix2y(target), { fill: '#ff0000' });
                    containerPos.add(target);
                }
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

    placeRoads(){
        var roads = new Set();
        for(let struct of this.structures){
            switch(struct.structureType){
                case STRUCTURE_EXTRACTOR:
                    this.extractor = struct;
                    this.addRoadsAround(struct, roads, 2);
                    break;
                case STRUCTURE_SPAWN:
                case STRUCTURE_STORAGE:
                    this.addRoadsAround(struct, roads, 1);
                    break;
                case STRUCTURE_CONTROLLER:
                    if(this.room.memory.role == 'core'){
                        this.addRoadsAround(struct, roads, 2);
                    }
                    break;
                case STRUCTURE_EXTENSION:
                    for(let pos of rpos){
                        var target = xy2ix(struct.pos.x + pos[0], struct.pos.y + pos[1]);
                        if(this.grid[target] < 3){
                            roads.add(target);
                        }
                    }
                    break;
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
        if(structs.containers.length > 0 && this.room.getAvailableStructureCount(STRUCTURE_CONTAINER) > 0){
            let targetPos = ix2pos(_.first(structs.containers), this.room.name);
            console.log('Building container at', targetPos);
            targetPos.createConstructionSite(STRUCTURE_CONTAINER);
        }
        if(!this.extractor && this.room.memory.role == 'core' && this.room.getAvailableStructureCount(STRUCTURE_EXTRACTOR) > 0){
            let mineral = _.first(this.room.find(FIND_MINERALS));
            if(mineral){
                console.log('Building extractor at', mineral.pos);
                mineral.pos.createConstructionSite(STRUCTURE_EXTRACTOR);
            }
        }
        this.placeTags();
    }

    findNearby(pos, type, range){
        var buildings = this.buildings[type] || [];
        return _.filter(buildings, struct => pos.getRangeTo(struct) <= range);
    }

    findNearbyTypes(pos, types, range){
        return _.filter(this.structures, struct => types.includes(struct.structureType) && pos.getRangeTo(struct) <= range);
    }

    placeTags(){
        if(this.room.controller && this.room.memory.role == 'core'){
            let pos = this.room.controller.pos;
            let containers = this.findNearby(pos, STRUCTURE_CONTAINER, 3);
            if(containers.length > 0 && !containers.some(container => container.hasTag('stockpile'))){
                for(let container of containers){
                    if(!container.hasTag('stockpile')){
                        container.addTag('stockpile');
                        console.log('Added stockpile tag to', container, 'in', container.pos.roomName);
                        break;
                    }
                }
            }
            let links = this.findNearby(pos, STRUCTURE_LINK, 3);
            if(links.length > 0 && !links.some(link => link.hasTag('output'))){
                for(let link of links){
                    if(!link.hasTag('output')){
                        link.addTag('output');
                        console.log('Added link output tag to', link, 'in', link.pos.roomName);
                        break;
                    }
                }
            }
        }
        for(let source of this.sources){
            let links = this.findNearby(source.pos, STRUCTURE_LINK, 2);
            if(links.length > 0 && !links.some(link => link.hasTag('input'))){
                for(let link of links){
                    if(!link.hasTag('input')){
                        link.addTag('input');
                        console.log('Added link input tag to', link, 'in', link.pos.roomName);
                        break;
                    }
                }
            }
        }
        // cluster.update('labs', _.filter(_.map(cluster.rooms, room => _.map(cluster.getStructuresByType(room, STRUCTURE_LAB), 'id')), list => list.length > 0));
    }



}

module.exports = AutoBuilder;