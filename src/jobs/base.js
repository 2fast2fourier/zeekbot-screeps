"use strict";

class BaseJob {
    constructor(catalog, type, flagPrefix){
        this.catalog = catalog;
        this.type = type;
        this.flagPrefix = flagPrefix;
    }

    getType(){
        return this.type;
    }

    generateId(entity){
        return this.type+'-'+entity.id;
    }

    getRooms(){
        if(this.flagPrefix){
            return this.catalog.rooms.concat(_.map(_.filter(Game.flags, flag => flag.name.startsWith(this.flagPrefix) && flag.room), 'room'));
        }else{
            return this.catalog.rooms;
        }
    }

    generate(){
        var jobs = {};
        _.forEach(this.getRooms(), room => _.forEach(this.generateJobs(room), job => jobs[job.id] = job));
        return jobs;
    }

    generateJobs(room){
        return [];
    }

}

module.exports = BaseJob;