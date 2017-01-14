"use strict";

var BaseAction = require('./base');
var Util = require('../util');

class BoostAction extends BaseAction {
    constructor(catalog){
        super(catalog, 'boost');
    }

    shouldBlock(creep, opts){
        if(creep.memory.calculateBoost){
            creep.memory.boosted = _.countBy(_.filter(creep.body, 'boost'), 'boost');
            delete creep.memory.calculateBoost;
        }
        if(!creep.memory.boost && creep.memory.actions.boost){
            delete creep.memory.actions.boost;
        }
        return creep.memory.boost;
    }

    blocked(creep, opts, block){
        var mineral = _.isString(block) ? block : _.first(block);
        var labs = Memory.boost.labs[mineral];
        if(!labs){
            console.log(creep, 'no lab allocated to boost', mineral);
            delete creep.memory.boost;
            return;
        }
        var lab = _.first(Util.sort.closestReal(creep, Util.getObjects(labs)));
        if(lab){
            // console.log('boost', creep, mineral, lab);
            if(!lab || lab.mineralType != mineral || lab.mineralAmount < 50){
                console.log(creep, 'not enough to boost', mineral, lab);
                delete creep.memory.boost;
                return;
            }
            if(creep.pos.getRangeTo(lab) > 1){
                creep.moveTo(lab, { reusePath: 15 });
            }else if(lab.boostCreep(creep) == OK){
                this.boosted(creep, mineral);
            }
        }else{
            console.log(creep, 'no lab allocated to boost', mineral);
            delete creep.memory.boost;
            return;
        }
    }

    boosted(creep, mineral){
        Memory.boost.update = true;
        if(_.isString(creep.memory.boost)){
            delete creep.memory.boost;
        }else if(_.isArray(creep.memory.boost)){
            if(creep.memory.boost.length > 1){
                creep.memory.boost = _.without(creep.memory.boost, mineral);
            }else{
                delete creep.memory.boost;
            }
        }else{
            console.log('boosted err', creep.memory.boost);
        }
        creep.memory.calculateBoost = true;
    }
}


module.exports = BoostAction;