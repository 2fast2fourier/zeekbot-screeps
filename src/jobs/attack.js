"use strict";

var BaseJob = require('./base');

class AttackJob extends BaseJob {
    constructor(catalog){ super(catalog, 'attack', { flagPrefix: 'Attack' }); }

    calculateCapacity(room, target){
        return 30;
    }

    generateTargets(room){
        return this.catalog.getHostileCreeps(room);
    }

    generateJobsForFlag(flag){
        if(flag.room){
            var towers = flag.room.find(FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
            if(towers.length > 0){
                return _.map(towers, target => this.generateJobForTarget(flag.room, target));
            }
            var structures = _.filter(flag.room.find(FIND_HOSTILE_STRUCTURES), structure => structure.structureType != STRUCTURE_CONTROLLER);
            var targets = _.filter(this.catalog.getHostileCreeps(flag.room), enemy => flag.pos.getRangeTo(enemy) <= Memory.settings.flagRange.attack);
            if(structures.length > 0){
                targets = targets.concat(structures);
            }
            if(targets.length > 0){
                return _.map(targets, target => this.generateJobForTarget(flag.room, target));
            }
        }else{
            return [this.generateJobForTarget(flag.room, flag, flag)];
        }
        return [];
    }
}

module.exports = AttackJob;

