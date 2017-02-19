"use strict";

var BaseAction = require('./base');

class AvoidAction extends BaseAction {
    constructor(catalog){
        super(catalog, 'avoid');
        this.range = 6;
    }

    shouldBlock(creep, opts){
        // var avoid = this.catalog.getAvoid(creep.pos);
        // if(avoid && avoid.length > 0){
        //     var target = this.getJobTarget(creep);
        //     var positions = _.filter(avoid, pos => creep.pos.getRangeTo(pos) <= this.range);
        //     if(positions.length > 0){
        //         return _.map(positions, position => {
        //             if(target && target.pos.getRangeTo(position) < this.range && creep.pos.getRangeTo(position) == this.range - 1){
        //                 creep.memory.blockedUntil = Game.time + 5;
        //             }
        //             return { pos: position, range: this.range + 4 };
        //         });
        //     }else if(creep.memory.blockedUntil > Game.time){
        //         return true;
        //     }
        // }else if(creep.memory.blockedUntil){
        //     delete creep.memory.blockedUntil;
        // }
        return false;
    }

    blocked(creep, opts, block){
        // if(block === true && creep.memory.blockedUntil > Game.time){
        //     return;
        // }
        // if(block){
        //     var start = Game.cpu.getUsed();
        //     creep.memory.avoidUntil = Game.time + 10;
        //     delete creep.memory._move;
        //     var result = PathFinder.search(creep.pos, block, { flee: true });
        //     creep.move(creep.pos.getDirectionTo(result.path[0]));
        //     this.catalog.profileAdd('avoid', Game.cpu.getUsed() - start);
        // }
    }
}


module.exports = AvoidAction;