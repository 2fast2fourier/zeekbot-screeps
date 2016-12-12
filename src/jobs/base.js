"use strict";

class BaseJob {
    constructor(catalog, type, opts){
        this.catalog = catalog;
        this.type = type;
        if(opts){
            _.assign(this, opts);
        }
    }

    getType(){
        return this.type;
    }

    generateId(entity){
        return this.type+'-'+(entity.id || entity.name);
    }

    getRooms(){
        return this.catalog.rooms;
    }

    generate(){
        var jobs = {};
        _.forEach(this.getRooms(), room => _.forEach(this.generateJobs(room), job => jobs[job.id] = job));
        if(this.flagPrefix){
            _.forEach(this.catalog.getFlagsByPrefix(this.flagPrefix), flag => _.forEach(this.generateJobsForFlag(flag), job => jobs[job.id] = job));
        }
        return jobs;
    }

    generateJobs(room){
        return [];
    }

    generateJobsForFlag(flag){
        if(!flag.room){
            return [];
        }
        return this.generateJobs(flag.room);
    }

}

module.exports = BaseJob;