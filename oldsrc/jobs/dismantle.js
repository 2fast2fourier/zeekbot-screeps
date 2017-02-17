"use strict";

var BaseJob = require('./base');
var Util = require('../util');

class DismantleJob extends BaseJob {
    constructor(catalog){ super(catalog, 'dismantle', { flagPrefix: 'Dismantle' }); }

    calculateCapacity(room, target){
        return target.hits;
    }

    generateTargets(room, flag){
        if(!flag || !flag.room){
            return [];
        }
        var results = flag.pos.lookFor(LOOK_STRUCTURES);
        if(results && results.length > 0){
            return results;
        }else{
            console.log('No targets found:', flag.pos, flag.name);
            flag.remove();
        }
    }
}

module.exports = DismantleJob;