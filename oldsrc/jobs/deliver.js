"use strict";

var BaseJob = require('./base');

var offsets = {
    spawn: -0.25,
    extension: -0.25,
    container: 0.5,
    storage: 0.25,
    link: 0.125,
    tower: 0
};

var types = [
    STRUCTURE_SPAWN,
    STRUCTURE_EXTENSION,
    STRUCTURE_STORAGE,
    STRUCTURE_TOWER
];

var mineralContainers = [
    STRUCTURE_STORAGE
];

class DeliverJob extends BaseJob {
    constructor(catalog){ super(catalog, 'deliver'); }

    generateJobs(room){
        var energyNeeds = _.filter(this.catalog.getStructuresByType(room, types), structure => this.catalog.getAvailableCapacity(structure) > 0);
        var result = _.map(energyNeeds, entity => {
            return {
                allocated: 0,
                capacity: this.catalog.getAvailableCapacity(entity),
                id: this.generateId(entity),
                target: entity,
                creep: false,//this.catalog.isCreep(entity),
                offset: this.getOffset(entity.structureType, entity),
                minerals: _.includes(mineralContainers, entity.structureType),
                subtype: (entity.structureType == STRUCTURE_EXTENSION || entity.structureType == STRUCTURE_SPAWN || entity.structureType == STRUCTURE_TOWER) ? 'spawn' : false
            }
        });

        _.forEach(Memory.stockpile, id =>{
            var stockpile = Game.getObjectById(id);
            if(!stockpile){
                console.log('stockpile missing', id, stockpile);
                return;
            }
            var capacity = this.catalog.getAvailableCapacity(stockpile);
            if(capacity < 100){
                return;
            }
            result.push({
                allocated: 0,
                capacity: 5000,
                id: this.generateId(stockpile, 'stockpile'),
                target: stockpile,
                creep: false,
                offset: 0,
                minerals: false,
                subtype: 'stockpile'
            });
        });

        return result;
    }

    getOffset(type, entity){
        if(!type){
            return 0;
        }
        return _.get(offsets, type, 0);
    }
}

module.exports = DeliverJob;