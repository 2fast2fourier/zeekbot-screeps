"use strict";

var BaseJob = require('./base');

class HealJob extends BaseJob {
    constructor(catalog){ super(catalog, 'heal'); }

    generate(){
        var hurtCreeps = _.filter(Game.creeps, creep => creep.hits < creep.hitsMax);
        return _.reduce(hurtCreeps, (result, creep) => {
            var id = this.generateId(creep);
            result[id] = {
                allocated: 0,
                capacity: 2,
                id,
                target: creep
            }
            return result;
        }, {});
    }
}

module.exports = HealJob;