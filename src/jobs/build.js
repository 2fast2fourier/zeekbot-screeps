"use strict";

var BaseJob = require('./base');

var offsets = {
    container: -0.5,
    tower: -1,
    extension: -0.25,
    road: 0.5,
    constructedWall: 1,
    rampart: 1,
    spawn: -1,
    lab: 1.5,
    terminal: 1.5
}

class BuildJob extends BaseJob {
    constructor(catalog){ super(catalog, 'build'); }

    calculateCapacity(room, target){
        return Math.min(12, Math.ceil((target.progressTotal - target.progress) / 1000));
    }

    generate(){
        var jobs = {};
        _.forEach(_.map(Game.constructionSites, target => this.generateJobForTarget(null, target)), job => jobs[job.id] = job);
        return jobs;
    }

    generateJobForTarget(room, target, flag){
        var job = super.generateJobForTarget(room, target, flag);
        job.offset = _.get(offsets, target.structureType, 0);
        return job;
    }
}

module.exports = BuildJob;