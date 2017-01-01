"use strict";

class QuotaManager {
    constructor(catalog){
        this.catalog = catalog;
        this.quota = {};
    }

    process(){
        this.quota = _.cloneDeep(this.catalog.jobs.capacity);
        // _.forEach(this.catalog.jobs.capacity, (capacity, type)=>{
        //     this.quota[type] = capacity;
        // });

        this.quota.spawnhauler = this.catalog.rooms.length * 2;
        this.quota.levelerhauler = this.catalog.rooms.length * 2;
        if(Memory.stats.global.maxSpawn < 1200){
            this.quota.hauler = this.catalog.rooms.length * 4;
        }
        this.quota.repair = Math.ceil(Memory.stats.global.repair / 10000);

        this.catalog.profile('pickup-remote', this.quota['pickup-remote']);

        
        // console.log(this.quota.repair, Memory.stats.global.repair);
    }

    add(type, value){
        this.quota[type] = _.get(this.quota, type, 0) + value;
    }

    set(type, value){
        this.quota[type] = value;
    }

    get(type){
        return _.get(this.quota, type, 0);
    }
}

module.exports = QuotaManager;