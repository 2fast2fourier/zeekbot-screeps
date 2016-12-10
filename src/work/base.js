"use strict";

class BaseWorker {
    constructor(catalog, type){
        this.catalog = catalog;
        this.type = type;
    }

    getType(){
        return this.type;
    }

}

module.exports = BaseWorker;