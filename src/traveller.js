"use strict";
/**
 * https://gist.github.com/bonzaiferroni/bbbbf8a681f071dc13759da8a1be316e
 */
// const REPORT_CPU_THRESHOLD = 50;
const DEFAULT_MAXOPS = 40000;
const DEFAULT_STUCK_VALUE = 3;
class Traveler {
    constructor() {}
    findAllowedRooms(origin, destination, options = {}) {
        _.defaults(options, { restrictDistance: 16 });
        if (Game.map.getRoomLinearDistance(origin, destination) > options.restrictDistance) {
            return;
        }
        let allowedRooms = { [origin]: true, [destination]: true };
        let ret = Game.map.findRoute(origin, destination, {
            routeCallback: (roomName) => {
                if (options.routeCallback) {
                    let outcome = options.routeCallback(roomName);
                    if (outcome !== undefined) {
                        return outcome;
                    }
                }
                if (Game.map.getRoomLinearDistance(origin, roomName) > options.restrictDistance) {
                    return false;
                }
                let parsed;
                if (options.preferHighway) {
                    parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
                    let isHighway = (parsed[1] % 10 === 0) || (parsed[2] % 10 === 0);
                    if (isHighway) {
                        return 1;
                    }
                }
                if (!options.allowSK && !Game.rooms[roomName]) {
                    if (!parsed) {
                        parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
                    }
                    let fMod = parsed[1] % 10;
                    let sMod = parsed[2] % 10;
                    let isSK = !(fMod === 5 && sMod === 5) &&
                        ((fMod >= 4) && (fMod <= 6)) &&
                        ((sMod >= 4) && (sMod <= 6));
                    if (isSK) {
                        return 10;
                    }
                }
                if (!options.allowHostile && Memory.avoidRoom[roomName] &&
                    roomName !== destination && roomName !== origin) {
                    return Number.POSITIVE_INFINITY;
                }
                return 2.5;
            },
        });
        if (!_.isArray(ret)) {
            console.log(`couldn't findRoute to ${destination}`);
            return;
        }
        for (let value of ret) {
            allowedRooms[value.room] = true;
        }
        return allowedRooms;
    }
    findTravelPath(origin, destination, options = {}) {
        _.defaults(options, {
            ignoreCreeps: true,
            range: 1,
            maxOps: DEFAULT_MAXOPS,
            obstacles: [],
        });
        let allowedRooms;
        if (options.useFindRoute || (options.useFindRoute === undefined &&
            Game.map.getRoomLinearDistance(origin.pos.roomName, destination.pos.roomName) > 2)) {
            allowedRooms = this.findAllowedRooms(origin.pos.roomName, destination.pos.roomName, options);
        }
        let callback = (roomName) => {
            if (options.roomCallback) {
                let outcome = options.roomCallback(roomName, options.ignoreCreeps);
                if (outcome !== undefined) {
                    return outcome;
                }
            }
            if (allowedRooms) {
                if (!allowedRooms[roomName]) {
                    return false;
                }
            }
            else if (Memory.avoidRoom[roomName] && !options.allowHostile) {
                return false;
            }
            let room = Game.rooms[roomName];
            if (!room) {
                return;
            }
            let matrix;
            if (options.ignoreStructures) {
                matrix = new PathFinder.CostMatrix();
                if (!options.ignoreCreeps) {
                    Traveler.addCreepsToMatrix(room, matrix);
                }
            }
            else if (options.ignoreCreeps || roomName !== origin.pos.roomName) {
                matrix = this.getStructureMatrix(room);
            }
            else {
                matrix = this.getCreepMatrix(room);
            }
            for (let obstacle of options.obstacles) {
                matrix.set(obstacle.pos.x, obstacle.pos.y, 0xff);
            }
            return matrix;
        };
        return PathFinder.search(origin.pos, { pos: destination.pos, range: options.range }, {
            maxOps: options.maxOps,
            plainCost: options.ignoreRoads ? 1 : 2,
            roomCallback: callback,
            swampCost: options.ignoreRoads ? 5 : 10,
        });
    }
    travelTo(creep, destination, options = {}) {
        // initialize data object
        if (!creep.memory._travel) {
            creep.memory._travel = { stuck: 0, tick: Game.time, count: 0 };//cpu
        }
        let travelData = creep.memory._travel;
        if (creep.fatigue > 0) {
            travelData.tick = Game.time;
            return ERR_BUSY;
        }
        if (!destination) {
            return ERR_INVALID_ARGS;
        }
        // manage case where creep is nearby destination
        let rangeToDestination = creep.pos.getRangeTo(destination);
        if (rangeToDestination <= 1) {
            if (rangeToDestination === 1 && !(options.range >= 1)) {
                if (options.returnData) {
                    options.returnData.nextPos = destination.pos;
                }
                return creep.move(creep.pos.getDirectionTo(destination));
            }
            return OK;
        }
        // check if creep is stuck
        let hasMoved = true;
        if (travelData.prev) {
            travelData.prev = Traveler.initPosition(travelData.prev);
            if (creep.pos.inRangeTo(travelData.prev, 0)) {
                hasMoved = false;
                travelData.stuck++;
            }
            else {
                travelData.stuck = 0;
            }
        }
        // handle case where creep is stuck
        if (travelData.stuck >= DEFAULT_STUCK_VALUE && !options.ignoreStuck) {
            options.ignoreCreeps = false;
            delete travelData.path;
        }
        // handle case where creep wasn't traveling last tick and may have moved, but destination is still the same
        if (Game.time - travelData.tick > 1 && hasMoved) {
            delete travelData.path;
        }
        travelData.tick = Game.time;
        // delete path cache if destination is different
        if (!travelData.dest || travelData.dest.x !== destination.pos.x || travelData.dest.y !== destination.pos.y ||
            travelData.dest.roomName !== destination.pos.roomName) {
            delete travelData.path;
        }
        // pathfinding
        if (!travelData.path) {
            if (creep.spawning) {
                return ERR_BUSY;
            }
            travelData.dest = destination.pos;
            travelData.prev = undefined;
            let ret = this.findTravelPath(creep, destination, options);
            travelData.count++;
            if (ret.incomplete) {
                // console.log(`TRAVELER: incomplete path for ${creep.name}`);
                if (ret.ops < 2000 && options.useFindRoute === undefined && travelData.stuck < DEFAULT_STUCK_VALUE) {
                    options.useFindRoute = false;
                    ret = this.findTravelPath(creep, destination, options);
                    console.log(`attempting path without findRoute was ${ret.incomplete ? "not" : ""} successful`);
                }
            }
            travelData.end = _.last(ret.path);
            travelData.path = Traveler.serializePath(creep.pos, ret.path);
            travelData.stuck = 0;
        }
        if (!travelData.path || travelData.path.length === 0) {
            return ERR_NO_PATH;
        }
        // consume path and move
        if (travelData.prev && travelData.stuck === 0) {
            travelData.path = travelData.path.substr(1);
        }
        travelData.prev = creep.pos;
        let nextDirection = parseInt(travelData.path[0], 10);
        if (options.returnData) {
            options.returnData.nextPos = Traveler.positionAtDirection(creep.pos, nextDirection);
        }
        return creep.move(nextDirection);
    }
    getStructureMatrix(room) {
        this.refreshMatrices();
        if (!this.structureMatrixCache[room.name]) {
            let matrix = new PathFinder.CostMatrix();
            this.structureMatrixCache[room.name] = Traveler.addStructuresToMatrix(room, matrix, 1);
        }
        return this.structureMatrixCache[room.name];
    }
    static initPosition(pos) {
        return new RoomPosition(pos.x, pos.y, pos.roomName);
    }
    static addStructuresToMatrix(room, matrix, roadCost) {
        for (let structure of room.find(FIND_STRUCTURES)) {
            if (structure instanceof StructureRampart) {
                if (!structure.my) {
                    matrix.set(structure.pos.x, structure.pos.y, 0xff);
                }
            }
            else if (structure instanceof StructureRoad) {
                matrix.set(structure.pos.x, structure.pos.y, roadCost);
            }
            else if (structure.structureType !== STRUCTURE_CONTAINER) {
                // Can't walk through non-walkable buildings
                matrix.set(structure.pos.x, structure.pos.y, 0xff);
            }
        }
        for (let site of room.find(FIND_CONSTRUCTION_SITES)) {
            if (site.structureType === STRUCTURE_CONTAINER || site.structureType === STRUCTURE_ROAD) {
                continue;
            }
            matrix.set(site.pos.x, site.pos.y, 0xff);
        }
        return matrix;
    }
    getCreepMatrix(room) {
        this.refreshMatrices();
        if (!this.creepMatrixCache[room.name]) {
            this.creepMatrixCache[room.name] = Traveler.addCreepsToMatrix(room, this.getStructureMatrix(room).clone());
        }
        return this.creepMatrixCache[room.name];
    }
    static addCreepsToMatrix(room, matrix) {
        room.find(FIND_MY_CREEPS).forEach((creep) => {
            if(creep.memory._travel && creep.memory._travel.end && creep.memory._travel.tick >= Game.time - 1){
                matrix.set(creep.memory._travel.end.x, creep.memory._travel.end.y, 0x10);
            }
            matrix.set(creep.pos.x, creep.pos.y, creep.memory.sitting || 0xff);
        });
        return matrix;
    }
    static serializePath(startPos, path) {
        let serializedPath = "";
        let lastPosition = startPos;
        for (let position of path) {
            if (position.roomName === lastPosition.roomName) {
                serializedPath += lastPosition.getDirectionTo(position);
            }
            lastPosition = position;
        }
        return serializedPath;
    }
    refreshMatrices() {
        if (Game.time !== this.currentTick) {
            this.currentTick = Game.time;
            this.structureMatrixCache = {};
            this.creepMatrixCache = {};
        }
    }
    static positionAtDirection(origin, direction) {
        let offsetX = [0, 0, 1, 1, 1, 0, -1, -1, -1];
        let offsetY = [0, -1, -1, 0, 1, 1, 1, 0, -1];
        return new RoomPosition(origin.x + offsetX[direction], origin.y + offsetY[direction], origin.roomName);
    }
}
// exports.Traveler = Traveler;

// uncomment this to have an instance of traveler available through import
// exports.traveler = new Traveler();

// uncomment to assign an instance to global
// global.traveler = new Traveler();

// uncomment this block to assign a function to Creep.prototype: creep.travelTo(destination)
const traveler = new Traveler();
Creep.prototype.travelTo = function (destination, options) {
    return traveler.travelTo(this, destination, options);
};
module.exports = traveler;