"use strict";

var BaseAction = require('./base');

class AvoidAction extends BaseAction {
    constructor(catalog){
        super(catalog, 'avoid');
        this.range = 7;
    }

    shouldBlock(creep, opts){
        var avoid = this.catalog.getAvoid(creep.pos);
        if(avoid && avoid.length > 0){
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
            var result = PathFinder.search(creep.pos, block, { flee: true });
            creep.move(creep.pos.getDirectionTo(result.path[0]));
        }
    }
}


module.exports = AvoidAction;