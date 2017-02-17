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
        if(!subtype){
            subtype = 'reserve';
        }
        var target = _.get(flag.room, 'controller', flag);
        var access = this.catalog.getAccessibility(target.pos, target.room);
        var job = {
            allocated: 0,
            capacity: 2,
            id: this.type+"-"+flag.name,
            target,
            quota: 2
        };
        if(flag.room && subtype == 'downgrade' && !target.owner){
            flag.remove();
            target.pos.createFlag('Reserve-reserve-'+Game.time, COLOR_BROWN);
            return;
        }
        if(subtype == 'claim'){
            if(flag.room && flag.room.controller.my){
                flag.remove();
            }
            job[subtype] = true;
            job.subtype = 'reserve';
            job.id = this.type+"-reserve-"+flag.name;
            job.flag = flag;
        }else{
            job[subtype] = true;
            job.subtype = subtype;
            job.id = this.type+"-"+subtype+"-"+flag.name;
            if(subtype == 'downgrade'){
                job.capacity = Math.min(access * 10, 20);
                job.quota = job.capacity;
            }else{
                job.quota = _.get(target, 'reservation.ticksToEnd', 0) < 4000 ? 2 : 0;
            }
        }
        return [job];
    }
}

module.exports = ReserveJob;