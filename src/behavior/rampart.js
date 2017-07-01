"use strict";

var BaseAction = require('./base');
var Util = require('../util');

class RampartAction extends BaseAction {
    constructor(){
        super('rampart');
    }

    preWork(cluster, creep, opts){
        var data = creep.room.matrix;
        if(data.hostiles.length > 0){
            var range = opts.range || 1;
            var targets = _.filter(data.hostiles, hostile => creep.pos.getRangeTo(hostile) <= range);
            var useMass = range > 1 && _.some(targets, hostile => creep.pos.getRangeTo(hostile) <= 1);
            var target = _.last(_.sortBy(targets, target => _.get(data, ['targetted', target.id, 'value'], 0) - (target.hits / target.hitsMax)));
            if(target){
                if(range > 1){
                    if(creep.pos.getRangeTo(target) == 1 || useMass){
                        creep.rangedMassAttack(target);
                    }else{
                        creep.rangedAttack(target);
                    }
                }else{
                    creep.attack(target);
                }
                if(!data.targetted){
                    data.targetted = {};
                }
                if(!data.targetted[target.id]){
                    data.targetted[target.id] = {
                        id: target.id,
                        value: 0
                    };
                }
                data.targetted[target.id].value++;
            }
        }
    }

}


module.exports = RampartAction;