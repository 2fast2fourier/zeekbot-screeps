"use strict";

class QuotaManager {
    constructor(catalog){
        this.catalog = catalog;
        this.quota = {};
    }

    process(){
        this.quota = _.cloneDeep(this.catalog.jobs.capacity);

        this.quota.spawnhauler = _.size(Memory.roomlist.spawn) + 1;
        this.quota.keep = _.sum(Memory.roomlist.keep);
        this.quota.longhauler = _.sum(Memory.roomlist.pickup);
        this.quota.stockpilehauler = _.sum(Memory.roomlist.stockpile);

        this.quota['reserve-reserve'] = _.sum(_.map(this.catalog.jobs.subjobs['reserve-reserve'], 'quota'));
        // console.log(this.quota['reserve-reserve']);

        // console.log(this.quota.transfer);

        //spread the wealth
        if(Memory.stats.global.totalEnergy > 100000 && Memory.stats.global.energySpread < 0.9){
            this.quota.levelerhauler = Math.ceil((1 - Memory.stats.global.energySpread) * (Memory.stats.global.totalEnergy / 80000));
        }else{
            this.quota.levelerhauler = 0;
        }
        // console.log(_.size(this.catalog.creeps.type['assaultfighter']), this.quota['idle-assault']);

        if(Memory.stats.global.maxSpawn < 1200){
            this.quota.hauler = this.catalog.rooms.length * 4;
        }
        this.quota.repair = Math.ceil(Memory.stats.global.repair / 10000);

        this.catalog.profile('pickup-remote', this.quota['pickup-remote']);
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