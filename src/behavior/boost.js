"use strict";

var BaseAction = require('./base');
var Util = require('../util');

class BoostAction extends BaseAction {
    constructor(){
        super('boost');
    }

    shouldBlock(cluster, creep, opts){
        if(creep.memory.calculateBoost){
            creep.memory.boosted = _.countBy(_.filter(creep.body, 'boost'), 'boost');
            delete creep.memory.calculateBoost;
        }
        if(creep.memory.boost){
            return { type: this.type, data: creep.memory.boost }
        }
        return false;
    }

    blocked(cluster, creep, opts, block){
        var type = _.first(_.keys(creep.memory.boost));
        var resource = Game.boosts[type];
        var needed = creep.memory.boost[type];

        if(!creep.memory.boostlab){
            var available = cluster.boostMinerals[resource];
            if(available > 30 * needed){
                var boostLabs = _.invert(cluster.boost);
                creep.memory.boostlab = boostLabs[type];
            }
            if(!BoostAction.validateLab(creep.memory.boostlab, resource, needed)){
                console.log(cluster.id, 'Insufficient resources to boost', creep.name, resource, type);
                this.remove(cluster, creep, resource);
            }
        }

        if(creep.memory.boostlab){
            var lab = Game.getObjectById(creep.memory.boostlab);
            if(lab && lab.mineralType == resource && lab.mineralAmount >= needed * 30){
                if(creep.pos.getRangeTo(lab) > 1){
                    this.move(creep, lab);
                }else if(lab.boostCreep(creep) == OK){
                    this.remove(cluster, creep, type);
                }else{
                    Game.notify(cluster.id + ' - Unknown issue boosting ' + creep.name + ' - ' + resource + ' - ' + lab);
                    this.remove(cluster, creep, type);
                }
            }else{
                delete creep.memory.boostlab;
            }
        }
    }

    static validateLab(labId, resource, partCount){
        var lab = Game.getObjectById(labId);
        return lab && lab.mineralType == resource && lab.mineralAmount >= partCount * 30;
    }

    remove(cluster, creep, type){
        delete creep.memory.boostlab;
        if(_.size(creep.memory.boost) > 1){
            delete creep.memory.boost[type];
        }else{
            delete creep.memory.boost;
        }
        creep.memory.calculateBoost = true;
    }
}


module.exports = BoostAction;