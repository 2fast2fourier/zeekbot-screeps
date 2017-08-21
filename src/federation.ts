"use strict";

// global, but fancier

const DefenseMatrix = require('./defense');
import ProcessSystem from './systems/process';


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
    matrix: any;
    queue: ProcessSystem;
    allocated: any;

    _structures: StructureList;
    _resources: any;
    _roomflags: any;
    
    constructor(){
        this.queue = new ProcessSystem();
        this.matrix = new DefenseMatrix();
        Game.matrix = this.matrix;
        this.allocated = {};
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
                lab: [],
                totals: {
                    storage: 0,
                    terminal: 0,
                    lab: 0
                }
            };
        }));
        let cataFn = catalogStorage.bind(this, this._resources);
        _.forEach(this.structures.storage, cataFn);
        _.forEach(this.structures.terminal, cataFn);
        _.forEach(this.structures.lab, cataFn);
    }

    get roomflags(){
        if(!this._roomflags){
            this._roomflags = _.groupBy(Game.flags, 'pos.roomName');
        }
        return this._roomflags;
    }

}

export = Federation;