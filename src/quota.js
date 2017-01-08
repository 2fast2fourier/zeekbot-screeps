"use strict";

class QuotaManager {
    constructor(catalog){
        this.catalog = catalog;
        this.quota = {};
    }

    process(){
        this.quota = _.cloneDeep(this.catalog.jobs.capacity);

        var roomCount = this.catalog.rooms.length;

        this.quota.spawnhauler = roomCount * 2;

        this.quota.transfer = _.get(this.quota, 'transfer-deliver', 0) + _.get(this.quota, 'transfer-store', 0);
        // console.log(_.size(this.catalog.creeps.type['upgradeworker']), this.quota.upgrade);

        //spread the wealth
        if(Memory.stats.global.totalEnergy > 100000 && Memory.stats.global.energySpread < 0.9){
            this.quota.levelerhauler = Math.ceil((1 - Memory.stats.global.energySpread) * (Memory.stats.global.totalEnergy / 100000));
        }else{
            this.quota.levelerhauler = 0;
        }

        if(Memory.stats.global.maxSpawn < 1200){
            this.quota.hauler = this.catalog.rooms.length * 4;
        }
        this.quota.repair = Math.ceil(Memory.stats.global.repair / 10000);

        this.catalog.profile('pickup-remote', this.quota['pickup-remote']);

        
        // console.log(this.quota['pickup']);
        // _.forEach(this.quota, (quota, type)=> console.log(type, quota) );
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