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
            var targets = _.filter(this.catalog.getHostileCreeps(flag.room), enemy => flag.pos.getRangeTo(enemy) <= Memory.settings.flagRange.attack);
            return _.map(targets, target => this.generateJobForTarget(flag.room, target));
        }
        return [];
    }
}

module.exports = AttackJob;

