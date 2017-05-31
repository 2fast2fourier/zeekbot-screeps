"use strict";

// global, but fancier

var DefenseMatrix = require('./defense');

function catalogStorage(resources, storage){
    var stored = storage.getResourceList();
    for(let type in stored){
        let amount = stored[type];
        resources[type].total += amount;
        resources[type].totals[storage.structureType] += amount;
        resources[type][storage.structureType].push(storage);
        if(type != RESOURCE_ENERGY || storage.structureType == STRUCTURE_STORAGE){
            resources[type].stored += amount;
            resources[type].sources.push(storage);
        }
    }
}

class Federation {
    constructor(){
        this.matrix = new DefenseMatrix();
        Game.matrix = this.matrix;
    }

    get structures(){
        if(!this._structures){
            this.initStructures();
        }
        return this._structures;
    }

    initStructures(){
        this._structures = _.assign({
            spawn: [],
            extension: [],
            rampart: [],
            controller: [],
            link: [],
            storage: [],
            tower: [],
            observer: [],
            powerBank: [],
            powerSpawn: [],
            extractor: [],
            lab: [],
            terminal: [],
            nuker: []
        }, _.groupBy(Game.structures, 'structureType'));
    }

    get resources(){
        if(!this._resources){
            this.initResources();
        }
        return this._resources;
    }

    initResources(){
        this._resources = _.zipObject(RESOURCES_ALL, _.map(RESOURCES_ALL, resource => {
            return {
                total: 0,
                stored: 0,
                sources: [],
                storage: [],
                terminal: [],
                totals: {
                    storage: 0,
                    terminal: 0
                }
            };
        }));
        let cataFn = catalogStorage.bind(this, this._resources);
        _.forEach(this.structures.storage, cataFn);
        _.forEach(this.structures.terminal, cataFn);
    }

    get roomflags(){
        if(!this._roomflags){
            this._roomflags = _.groupBy(Game.flags, 'pos.roomName');
        }
        return this._roomflags;
    }

}

module.exports = Federation;

//Game.federation.resources.H.terminal.map(terminal=>terminal.send('H', terminal.store.H || 0, 'E28S73'))