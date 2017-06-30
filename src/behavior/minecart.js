"use strict";

var BaseAction = require('./base');

var offsets = {
    container: 0.5,
    storage: 0.25,
    link: 0,
    tower: -1
};

class MinecartAction extends BaseAction {
    constructor(){
        super('minecart');
    }

    postWork(cluster, creep, opts, action){
        if(_.sum(creep.carry) >= creep.carryCapacity * 0.7){
            var target = false;
            if(!creep.memory.containers){
                var structures = cluster.find(creep.room, FIND_STRUCTURES);
                var containerList = _.filter(structures, struct => struct.structureType == STRUCTURE_CONTAINER
                                                                || struct.structureType == STRUCTURE_STORAGE
                                                                || struct.structureType == STRUCTURE_LINK);
                creep.memory.containers = _.map(containerList, 'id');
            }
            if(creep.memory.cart){
                target = Game.getObjectById(creep.memory.cart);
            }
            if(!target || target.getAvailableCapacity() == 0 || creep.pos.getRangeTo(target) > 2){
                var containers = Game.getObjects(creep.memory.containers);
                var targets = _.filter(containers, struct => struct && struct.getAvailableCapacity() > 0 && creep.pos.getRangeTo(struct) <= 2);
                var nearby = _.sortBy(targets, target => offsets[target.structureType] + Math.max(1, creep.pos.getRangeTo(target)));
                if(nearby.length > 0){
                    target = _.first(nearby);
                    creep.memory.cart = target.id;
                }
            }

            if(target){
                if(creep.pos.getRangeTo(target) > 1){
                    this.move(creep, target);
                }else{
                    _.forEach(creep.carry, (amount, type)=>{
                        if(amount > 0){
                            creep.transfer(target, type);
                        }
                    });
                }
            }
        }
    }
}


module.exports = MinecartAction;