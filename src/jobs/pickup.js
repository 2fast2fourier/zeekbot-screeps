"use strict";

var BaseJob = require('./base');

class PickupJob extends BaseJob {
    constructor(catalog){ super(catalog, 'pickup'); }

    generateJobs(room){
        var energy = this.catalog.getResourceContainers(room, this.catalog.types.storage, RESOURCE_ENERGY);
        return _.map(energy, structure => {
            return {
                allocated: 0,
                capacity: Math.ceil(this.catalog.getResource(structure, RESOURCE_ENERGY)/50),
                id: this.generateId(structure),
                target: structure
            }
        });
    }
}

module.exports = PickupJob;