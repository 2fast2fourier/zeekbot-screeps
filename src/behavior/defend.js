"use strict";

var BaseAction = require('./base');
var Util = require('../util');

var range = 5;

class DefendAction extends BaseAction {
    constructor(){
        super('defend');
    }

    shouldBlock(cluster, creep, opts){
        var data = creep.room.matrix;
        var targets = opts.type ? data.creeps[opts.type] : data.hostiles;
        if(targets && targets.length > 0){
            if(opts.limit){
                var totals = opts.type ? data.total[opts.type] : data.total;
                for(let type in opts.limit){
                    let limit = opts.limit[type];
                    if(totals[type] > limit){
                        return false;
                    }
                }
            }
            var target = Util.closest(creep, targets);
            if(target){
                return { type: this.type, data: target };
            }
        }
        return false;
    }

    blocked(cluster, creep, opts, target){
        let range = creep.pos.getRangeTo(target);
        if(range > 1){
            this.move(creep, target);
        }
        if(opts.melee){
            if(range > 1){
                this.move(creep, target);
            }else{
                creep.attack(target);
            }
        }else{
            if(range > 1){
                this.move(creep, target);
            }
            if(range <= 1){
                creep.rangedMassAttack();
            }else if(range <= 3){
                creep.rangedAttack(target);
            }
        }
        if(opts.autoheal && creep.hits < creep.hitsMax){
            creep.heal(creep);
        }
    }

}


module.exports = DefendAction;