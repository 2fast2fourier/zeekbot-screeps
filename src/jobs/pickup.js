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
        var hostiles = this.catalog.getHostileCreeps(room);
        storage = _.filter(storage, target => _.size(_.filter(hostiles, hostile => target.pos.getRangeTo(hostile) <= 10)) == 0);
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
                    resource: type
                });
            });
        }, []);
        return result;
    }
}

module.exports = PickupJob;