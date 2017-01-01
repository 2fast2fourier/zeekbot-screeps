"use strict";

var BaseJob = require('./base');

class ReserveJob extends BaseJob {
    constructor(catalog){ super(catalog, 'reserve', { flagPrefix: 'Reserve' }); }

    // generate(){
    //     var jobs = super.generate();
    //     var downgradeFlags = this.catalog.getFlagsByPrefix('Downgrade');
    //     if(downgradeFlags.length > 0){
    //         _.forEach(downgradeFlags, flag =>{
    //             if(flag.room && !flag.room.controller.owner){
    //                 return;
    //             }
    //             var id = this.type+"-"+flag.name;
    //             jobs[id] = {
    //                 allocated: 0,
    //                 capacity: 50,
    //                 id,
    //                 target: _.get(flag.room, 'controller', flag),
    //                 downgrade: true
    //             };
    //         });
    //     }
    //     return jobs;
    // }

    generateJobsForFlag(flag){
        var subtype = this.getSubflag(flag);
        var job = {
            allocated: 0,
            capacity: 2,
            id: this.type+"-"+flag.name,
            target: _.get(flag.room, 'controller', flag)
        };
        if(subtype){
            job[subtype] = true;
            job.subtype = subtype;
            job.id = this.type+"-"+subtype+"-"+flag.name;
            if(subtype == 'downgrade'){
                job.capacity = 50;
            }
        }
        return [job];
    }
}

module.exports = ReserveJob;