"use strict";

var BaseJob = require('./base');

var types = {
    spawn: 2,
    worker: 1
}

class IdleJob extends BaseJob {
    constructor(catalog){ super(catalog, 'idle', { flagPrefix: 'Idle' }); }

    generateJobs(room){
        var target = _.first(this.catalog.getStructuresByType(room, STRUCTURE_SPAWN)) || room.controller;
        var spots = _.map(types, (capacity, type) => {
            return {
                allocated: 0,
                capacity: capacity,
                id: this.generateId(target)+"-"+type,
                target: target,
                idleType: type,
                subtype: type
            };
        });
        spots.push({
            allocated: 0,
            capacity: 4,
            id: this.generateId(room.controller),
            target: room.controller
        });
        return spots;
    }

    generateJobsForFlag(flag){
        var parts = flag.name.split('-');
        if(parts.length >= 3){
            return [{
                allocated: 0,
                capacity: _.parseInt(parts[2]) || 1,
                id: this.generateId(flag)+"-"+parts[1],
                target: flag,
                idleType: parts[1],
                subtype: parts[1]
            }];
        }
        if(parts.length == 2){
            return [{
                allocated: 0,
                capacity: 2,
                id: this.generateId(flag)+"-"+parts[1],
                target: flag,
                idleType: parts[1],
                subtype: parts[1]
            }];
        }
        return [];
    }
}

module.exports = IdleJob;