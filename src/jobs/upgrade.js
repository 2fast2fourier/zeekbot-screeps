"use strict";

var BaseJob = require('./base');

class UpgradeJob extends BaseJob {
    constructor(catalog){ super(catalog, 'upgrade', { flagPrefix: 'Upgrade' }); }
    
    calculateCapacity(room, target, flag){
        var capacity = Memory.settings.upgradeCapacity || 10;
        if(flag){
            var flagparts = flag.name.split('-');
            if(flagparts.length > 2){
                return _.parseInt(flagparts[1]);
            }else{
                return capacity * 2;
            }
        }
        return capacity;
    }

    generate(){
        var jobs = {};
        var jobRooms = {};
        _.forEach(this.catalog.rooms, room => {
            var job = this.generateJobForTarget(room, room.controller);
            jobs[job.id] = job;
            jobRooms[room.name] = job;
        });
        if(this.flagPrefix){
            _.forEach(this.catalog.getFlagsByPrefix(this.flagPrefix), flag => {
                jobRooms[flag.pos.roomName].capacity = this.calculateCapacity(flag.room, jobRooms[flag.pos.roomName].target, flag);
            });
        }
        // _.forEach(jobs, job=>console.log(job.target, job.capacity));
        
        return this.postGenerate(jobs);
    }

    // addAllocation(jobs, jobId, allocation){
    //     super.addAllocation(jobs, jobId, allocation);
    //     // console.log(jobs[jobId].target.pos.roomName, jobs[jobId].allocated, allocation);
    // }
}

module.exports = UpgradeJob;