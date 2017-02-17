"use strict";

var BaseJob = require('./base');

class AttackJob extends BaseJob {
    constructor(catalog){ super(catalog, 'attack', { flagPrefix: 'Attack' }); }

    calculateCapacity(room, target, flag){
        return 60;
    }

    generateTargets(room){
        return this.catalog.getHostileCreeps(room);
    }

    generateJobsForFlag(flag){
        var subtype = this.getSubflag(flag);
        if(flag.room){
            if(flag.name.includes('target')){
                var results = flag.pos.lookFor(LOOK_STRUCTURES);
                if(results && results.length > 0){
                    // console.log(results);
                    return _.map(results, target => this.generateJobForTarget(flag.room, target, flag, subtype));
                }
            }
            var hostileStructures = flag.room.find(FIND_HOSTILE_STRUCTURES);
            var towers = _.filter(hostileStructures, structure => structure.structureType == STRUCTURE_TOWER);
            if(towers.length > 0){
                return _.map(towers, target => this.generateJobForTarget(flag.room, target, flag, subtype));
            }
            var spawns = _.filter(hostileStructures, structure => structure.structureType == STRUCTURE_SPAWN);
            if(spawns.length > 0){
                return _.map(spawns, target => this.generateJobForTarget(flag.room, target, flag, subtype));
            }
            var structures = _.filter(hostileStructures, structure => structure.structureType != STRUCTURE_CONTROLLER && structure.structureType != STRUCTURE_RAMPART);
            var targets = _.filter(this.catalog.getHostileCreeps(flag.room), enemy => flag.pos.getRangeTo(enemy) <= Memory.settings.flagRange.attack);
            if(structures.length > 0){
                targets = targets.concat(structures);
            }
            if(targets.length > 0){
                return _.map(targets, target => this.generateJobForTarget(flag.room, target, flag, subtype));
            }
        }else{
            return [this.generateJobForTarget(flag.room, flag, flag, subtype)];
        }
        return [];
    }

    generateJobForTarget(room, target, flag, subtype){
        var job = super.generateJobForTarget(room, target, flag);
        if(subtype){
            job.subtype = subtype;
            job.id = this.generateId(target, subtype);
        }
        return job;
    }
}

module.exports = AttackJob;

