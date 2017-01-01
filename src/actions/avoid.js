"use strict";

var BaseAction = require('./base');

class AvoidAction extends BaseAction {
    constructor(catalog){
        super(catalog, 'avoid');
        this.range = 5;
    }

    shouldBlock(creep, opts){
        var avoid = this.catalog.getAvoid(creep.pos);
        if(avoid && avoid.length > 0){
            var target = this.getJobTarget(creep);
            var positions = _.filter(avoid, pos => creep.pos.getRangeTo(pos) < this.range);
            if(positions.length > 0){
                return _.map(positions, position => {
                    return { pos: position, range: this.range };
                });
            }
        }
        return false;
    }

    postWork(creep, opts, action, block){
        if(block){
            creep.memory.avoidUntil = Game.time + 10;
            delete creep.memory._move;
            var result = PathFinder.search(creep.pos, block, { flee: true });
            creep.move(creep.pos.getDirectionTo(result.path[0]));
        }
    }
}


module.exports = AvoidAction;