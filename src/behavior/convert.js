"use strict";

var BaseAction = require('./base');

class ConvertAction extends BaseAction {
    constructor(){
        super('convert');
    }

    preWork(cluster, creep, opts){
        if(creep.memory.jobType == 'idle' && creep.ticksToLive < 1000){
            if(creep.ticksToLive > 300){
                console.log('Converted', creep.name, 'to', opts.type);
                creep.memory.type = opts.type;
                creep.memory.job = false;
                creep.memory.jobType = false;
                creep.memory.jobSubType = false;
                creep.memory.quota = opts.quota;
                creep.memory.quotaAlloc = opts.quotaAlloc;
                creep.memory.cpu = 0;
            }else{
                creep.suicide();
            }
        }
    }

}


module.exports = ConvertAction;