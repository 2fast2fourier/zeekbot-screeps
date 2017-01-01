"use strict";

var BaseAction = require('./base');

var offsets = {
    container: 0.5,
    storage: 0.25,
    link: 0,
};

class MinecartAction extends BaseAction {
    constructor(catalog){
        super(catalog, 'minecart');
    }

    postWork(creep, opts, action){
        if(_.sum(creep.carry) > creep.carryCapacity * 0.8){
            var containers = this.catalog.lookForArea(creep.room, creep.pos, LOOK_STRUCTURES, 2);
            var targets = _.filter(containers, struct => (struct.structureType == STRUCTURE_CONTAINER || struct.structureType == STRUCTURE_STORAGE || struct.structureType == STRUCTURE_LINK) && this.catalog.notFull(struct));
            var nearby = _.sortBy(targets, target => offsets[target.structureType]);
            if(nearby.length > 0){
                _.forEach(creep.carry, (amount, type)=>{
                    if(amount > 0){
                        if(creep.transfer(nearby[0], type) == ERR_NOT_IN_RANGE){
                            creep.moveTo(nearby[0]);
                        }
                    }
                });
            }
        }
    }
}


module.exports = MinecartAction;