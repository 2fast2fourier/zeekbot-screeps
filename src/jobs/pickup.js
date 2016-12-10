"use strict";

var BaseJob = require('./base');

class PickupJob extends BaseJob {
    constructor(catalog){ super(catalog, 'pickup'); }

    generateJobs(room){
        var energyNeeds = _.filter(this.catalog.getStructuresByType(room, this.catalog.types.energyNeeds), structure => this.catalog.getStorage(structure) < this.catalog.getCapacity(structure));
        return _.map(energyNeeds, structure => {
            return {
                allocated: 0,
                capacity: Math.ceil(this.catalog.getAvailableCapacity(structure)/50),
                id: this.generateId(structure),
                target: structure
            }
        });
    }
}

module.exports = PickupJob;