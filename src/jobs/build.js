"use strict";

var BaseJob = require('./base');

class BuildJob extends BaseJob {
    constructor(catalog){ super(catalog, 'build'); }

    calculateCapacity(room, target){
        return (target.progressTotal - target.progress) <= 200 ? 1 : 2;
    }

    generate(){
        var jobs = {};
        _.forEach(_.map(Game.constructionSites, target => this.generateJobForTarget(null, target)), job => jobs[job.id] = job);
        return jobs;
    }
}

module.exports = BuildJob;