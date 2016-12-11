"use strict";

var BaseJob = require('./base');

var offsets = {
    spawn: -0.25,
    extension: -0.25,
    container: 0.5,
    storage: 0.25,
    link: 0.125
};

class DeliverJob extends BaseJob {
    constructor(catalog){ super(catalog, 'deliver'); }

    generateJobs(room){
        var energyNeeds = _.filter(this.catalog.getStructuresByType(room, this.catalog.types.energyNeeds), structure => this.catalog.getAvailableCapacity(structure) > 0);
        var creeps = this.catalog.creeps.class['worker'];
        if(creeps && creeps.length > 0){
            energyNeeds = energyNeeds.concat(creeps);
        }
        return _.map(energyNeeds, entity => {
            return {
                allocated: 0,
                capacity: this.catalog.getAvailableCapacity(entity),
                id: this.generateId(entity),
                target: entity,
                creep: this.catalog.isCreep(entity),
                offset: this.getOffset(entity.structureType)
            }
        });
    }

    getOffset(type){
        if(!type){
            return 0;
        }
        return _.get(offsets, type, 0);
    }
}

module.exports = DeliverJob;