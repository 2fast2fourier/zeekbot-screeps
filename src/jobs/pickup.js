"use strict";

var BaseJob = require('./base');

var types = [
    STRUCTURE_STORAGE,
    STRUCTURE_CONTAINER,
    STRUCTURE_LINK
];

class PickupJob extends BaseJob {
    constructor(catalog){ super(catalog, 'pickup', { flagPrefix: 'Pickup' }); }

    generateJobs(room, flag){
        var dropped = this.catalog.getDroppedResources(room);
        var storage = _.filter(this.catalog.getStructuresByType(room, types), structure => this.catalog.getStorage(structure) > 0);
        storage = storage.concat(dropped);
        var result = [];
        _.forEach(storage, (entity) => {
            _.forEach(this.catalog.getResourceList(entity), (amount, type)=>{
                if(entity.structureType == STRUCTURE_STORAGE && type != RESOURCE_ENERGY){
                    return;
                }
                result.push({
                    allocated: 0,
                    capacity: amount,
                    id: this.generateId(entity),
                    target: entity,
                    dropped: !!entity.resourceType,
                    resource: type,
                    subtype: type != RESOURCE_ENERGY ? 'mineral' : !!flag ? 'remote' : false
                });
            });
        }, []);
        return result;
    }

    postGenerate(jobs){
        var storage = _.first(_.sortBy(this.catalog.buildings.storage, storage => -storage.store[RESOURCE_ENERGY]));
        if(storage){
            var id = this.generateId(storage, 'level');
            var levelJob = {
                allocated: 0,
                capacity: storage.store[RESOURCE_ENERGY],
                id,
                target: storage,
                dropped: false,
                resource: RESOURCE_ENERGY,
                subtype: 'level'
            };
            jobs[id] = levelJob;
        }
        return jobs;
    }
}

module.exports = PickupJob;