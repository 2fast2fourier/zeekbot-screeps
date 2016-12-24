"use strict";

class BaseAction {
    constructor(catalog, type){
        this.catalog = catalog;
        this.type = type;
    }

    preWork(creep, opts){}

    shouldBlock(creep, opts){
        return false;
    }

    postWork(creep, opts, action){}

    hasJob(creep){
        return creep.memory.jobId && creep.memory.jobType;
    }

}

module.exports = BaseAction;