"use strict";

var RoomUtil = require('../roomutil');
var { RemoteBaseBehavior } = require('./base');

class BuildBehavior extends RemoteBaseBehavior {
    constructor(){ super('build'); }

    stillValid(creep, data, catalog){
        return creep.carry.energy > 0 && RoomUtil.exists(creep.memory.traits.build);
    }

    bid(creep, data, catalog){
        var ideal = data.ideal || 0;
        var jobsActive = _.get(catalog.traitCount, 'build', 0);
        var jobPriority = 0;
        var energy = creep.carry.energy / creep.carryCapacity;
        if(jobsActive < ideal){
            jobPriority = (jobsActive-ideal)*11;
        }
        var constructionSites = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
        if(constructionSites.length > 0 && RoomUtil.getEnergy(creep) > 0){
            return (1 - energy) + (data.priority || 0) + jobPriority*energy;
        }else{
            return false;
        }
    }

    start(creep, data, catalog){
        var constructionSites = _.sortBy(creep.room.find(FIND_MY_CONSTRUCTION_SITES), site => creep.pos.getRangeTo(site)/50 + (1 - site.progress / site.progressTotal));
        this.setTrait(creep, _.get(constructionSites, '[0].id', false));
        creep.say('building');
        return RoomUtil.exists(this.trait(creep));
    }

    process(creep, data, catalog){
        var target = this.target(creep);
        if(target && creep.build(target) == ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        }
    }
};

module.exports = BuildBehavior;