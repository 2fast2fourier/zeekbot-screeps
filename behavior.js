"use strict";

var RoomUtil = require('roomutil');

class BaseBehavior {
    constructor(type){
        this.type = type;
    }

    stillValid(creep, data, catalog){ return creep.memory.traits[this.type] && !!this.target(creep); }
    bid(creep, data, catalog){ return false; }
    start(creep, data, catalog){ return false; }
    process(creep, data, catalog){ }

    end(creep, data, catalog){
        delete creep.memory.traits[this.type];
    }

    target(creep){
        return Game.getObjectById(creep.memory.traits[this.type]);
    }

    trait(creep){
        return creep.memory.traits[this.type];
    }

    exists(creep){
        return !!this.target(creep);
    }

    setTrait(creep, trait){
        if(trait === false){
            delete creep.memory.traits[this.type];
        }else{
            creep.memory.traits[this.type] = trait;
        }
    }
}

class RemoteBaseBehavior extends BaseBehavior {
    constructor(type){ super(type); }

    stillValid(creep, data, catalog){
        var flag = Game.flags[data.flag];
        if(flag && (creep.pos.roomName != flag.pos.roomName || RoomUtil.onEdge(creep.pos))){
            return true;
        }
        return false;
    }
    bid(creep, data, catalog){
        var flag = Game.flags[data.flag];
        return flag && creep.pos.roomName != flag.pos.roomName;
    }
    start(creep, data, catalog){
        var flag = Game.flags[data.flag];
        return flag && creep.pos.roomName != flag.pos.roomName;
    }
    process(creep, data, catalog){
        var flag = Game.flags[data.flag];
        if(flag && (creep.pos.roomName != flag.pos.roomName || RoomUtil.onEdge(creep.pos))){
            creep.moveTo(flag);
            return true;
        }
        return false;
    }
}

class MiningBehavior extends RemoteBaseBehavior {
    constructor(){ super('mining'); }

    stillValid(creep, data, catalog){
        if(super.stillValid(creep, data, catalog)){
            return true;
        }
        var target = Game.getObjectById(creep.memory.traits.mining);
        if(target && data.maxRange && data.maxRange < creep.pos.getRangeTo(target)){
            return false;
        }
        return creep.carry.energy < creep.carryCapacity - 10 && target;
    }

    bid(creep, data, catalog){
        if(super.bid(creep, data, catalog)){
            return -999;
        }
        if(creep.carry.energy >= creep.carryCapacity){
            return false;
        }
        return creep.carry.energy / creep.carryCapacity + (data.priority || 0);
    }

    start(creep, data, catalog){
        if(super.start(creep, data, catalog)){
            return true;
        }
        if(creep.memory.lastSource && RoomUtil.exists(creep.memory.lastSource)){
            creep.memory.traits.mining = creep.memory.lastSource;
        }else{
            creep.memory.traits.mining = RoomUtil.findFreeMiningId(creep.room, creep, catalog);
        }
        
        return RoomUtil.exists(creep.memory.traits.mining);
    }

    process(creep, data, catalog){
        if(super.process(creep, data, catalog)){
            return;
        }
        var source = this.target(creep);
        if(source && creep.harvest(source) == ERR_NOT_IN_RANGE) {
            creep.moveTo(source);
        }
    }

    end(creep, data, catalog){
        creep.memory.lastSource = this.trait(creep);
        super.end(creep, data, catalog);
    }
};

class BuildBehavior extends RemoteBaseBehavior {
    constructor(){ super('build'); }

    stillValid(creep, data, catalog){
        return creep.carry.energy > 0 && RoomUtil.exists(creep.memory.traits.build);
    }

    bid(creep, data, catalog){
        var ideal = data.ideal || 0;
        var jobsActive = _.get(catalog.traitCount, 'build', 0);
        var jobPriority = 0;
        var energy = creep.carry.energy / creep.carryCapacity;
        if(jobsActive < ideal){
            jobPriority = (jobsActive-ideal)*11;
        }
        var constructionSites = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
        if(constructionSites.length > 0 && RoomUtil.getEnergy(creep) > 0){
            return (1 - energy) + (data.priority || 0) + jobPriority*energy;
        }else{
            return false;
        }
    }

    start(creep, data, catalog){
        var constructionSites = _.sortBy(creep.room.find(FIND_MY_CONSTRUCTION_SITES), site => creep.pos.getRangeTo(site)/50 + (1 - site.progress / site.progressTotal));
        this.setTrait(creep, _.get(constructionSites, '[0].id', false));
        creep.say('building');
        return RoomUtil.exists(this.trait(creep));
    }

    process(creep, data, catalog){
        var target = this.target(creep);
        if(target && creep.build(target) == ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        }
    }
};

class UpgradeBehavior extends RemoteBaseBehavior {
    constructor(){ super('upgrade'); }

    stillValid(creep, data, catalog){
        if(super.stillValid(creep, data, catalog)){
            return true;
        }
        return creep.carry.energy > 0 && creep.room.controller && creep.room.controller.my;
    }

    bid(creep, data, catalog){
        if(super.bid(creep, data, catalog)){
            return -999;
        }
        var ideal = data.ideal || 0;
        var upgradersActive = _.get(catalog.traitCount, 'upgrade', 0);
        var jobPriority = 0;
        var energy = creep.carry.energy / creep.carryCapacity;
        if(upgradersActive < ideal){
            jobPriority = (upgradersActive-ideal)*11;
        }
        if(creep.room.controller && creep.room.controller.my && RoomUtil.getEnergy(creep) > 0){
            return (1 - energy) + (data.priority || 0) + jobPriority*energy;
        }else{
            return false;
        }
    }

    start(creep, data, catalog){
        if(super.start(creep, data, catalog)){
            return true;
        }
        creep.say('upgrading');
        creep.memory.traits.upgrade = true;
        return creep.room.controller.my && RoomUtil.getEnergy(creep) > 0;
    }

    process(creep, data, catalog){
        if(super.process(creep, data, catalog)){
            return;
        }
        if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller);
        }
    }
};

class RepairBehavior extends RemoteBaseBehavior {
    constructor(){ super('repair'); }

    stillValid(creep, data, catalog){
        if(super.stillValid(creep, data, catalog)){
            return true;
        }
        var target = Game.getObjectById(creep.memory.traits.repair);
        return creep.carry.energy > 0 && target && target.pos.roomName == creep.pos.roomName && target.hits < target.hitsMax && target.hits < Memory.repairTarget;
    }

    bid(creep, data, catalog){
        if(super.bid(creep, data, catalog)){
            return -999;
        }
        var ideal = data.ideal || 0;
        var repairsActive = _.get(catalog.traitCount, 'repair', 0);
        var jobPriority = 0;
        var energy = creep.carry.energy / creep.carryCapacity;
        if(repairsActive < ideal){
            jobPriority = (repairsActive-ideal)*11;
        }
        var repairable = _.filter(catalog.buildings[creep.pos.roomName], building => building.hits < building.hitsMax && building.hits < Memory.repairTarget);
        if(repairable.length > 0 && RoomUtil.getEnergy(creep) > 0){
            return (1 - energy) + (data.priority || 0) + jobPriority*energy;
        }else{
            return false;
        }
    }

    start(creep, data, catalog){
        if(super.start(creep, data, catalog)){
            return true;
        }
        var repairable = _.sortBy(_.filter(catalog.buildings[creep.pos.roomName], building => building.hits < building.hitsMax && building.hits < Memory.repairTarget),
                                  (target)=>target.hits / Math.min(target.hitsMax, Memory.repairTarget) + creep.pos.getRangeTo(target)/100);
        if(repairable.length > 0){
            creep.memory.traits.repair = repairable[0].id;
            creep.say('repair');
            return RoomUtil.exists(creep.memory.traits.repair);
        }else{
            return false;
        }
    }

    process(creep, data, catalog){
        if(super.process(creep, data, catalog)){
            return true;
        }
        var target = Game.getObjectById(creep.memory.traits.repair);
        if(target && creep.repair(target) == ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        }
    }
};

class EmergencyDeliver extends BaseBehavior {
    constructor(){ super('emergencydeliver'); };

    stillValid(creep, data, catalog){
        var target = this.target(creep);
        return target && creep.carry.energy > 0 && RoomUtil.getEnergyPercent(target) < 0.9;
    }

    bid(creep, data, catalog){
        if(RoomUtil.getEnergyPercent(creep) > 0.25 && _.get(catalog.deficits, creep.pos.roomName, 0) > 0){
            return -999;
        }
        return false;
    }

    start(creep, data, catalog){
        var opts = {
            ignoreCreeps: true,
            containerTypes: [
                STRUCTURE_EXTENSION,
                STRUCTURE_SPAWN
            ]
        };
        var deliverable = catalog.getEnergyNeeds(creep, opts);
        this.setTrait(creep, _.get(deliverable, '[0].id', false));
        return this.exists(creep);
    }

    process(creep, data, catalog){
        var target = this.target(creep);
        var result = creep.transfer(target, RESOURCE_ENERGY);
        if(result == ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        }
    }
}

class DeliverBehavior extends RemoteBaseBehavior {
    constructor(){ super('deliver'); };

    stillValid(creep, data, catalog){
        if(creep.carry.energy > 0 && super.stillValid(creep, data, catalog)){
            return true;
        }
        var target = Game.getObjectById(creep.memory.traits.deliver);
        if(data.maxRange && creep.pos.getRangeTo(target) > data.maxRange){
            return false;
        }
        if(creep.carry.energy == 0 || target == null){
            return false;
        }else{
            return RoomUtil.getEnergyPercent(target) < 0.85;
        }
    }

    bid(creep, data, catalog){
        var energy = RoomUtil.getEnergyPercent(creep);
        if(energy > 0.1 && super.bid(creep, data, catalog)){
            return 1-energy;
        }
        var deliverable = catalog.getEnergyNeeds(creep, data);
        if(deliverable.length > 0 && RoomUtil.getEnergy(creep) > 0){
            return (0.5 - energy) + (data.priority || 0) + (creep.pos.getRangeTo(deliverable[0])/25) + (RoomUtil.getEnergyPercent(deliverable[0]));
        }else{
            return false;
        }
    }

    start(creep, data, catalog){
        if(super.start(creep, data, catalog)){
            return true;
        }
        var deliverable = catalog.getEnergyNeeds(creep, data);
        if(deliverable.length > 0){
            creep.memory.traits.deliver = deliverable[0].id;
            return RoomUtil.exists(creep.memory.traits.deliver);
        }else{
            return false;
        }
    }

    process(creep, data, catalog){
        if(super.process(creep, data, catalog)){
            return;
        }
        var target = Game.getObjectById(creep.memory.traits.deliver);
        var result = creep.transfer(target, RESOURCE_ENERGY);
        if(result == ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        }
    }
};

class AttackBehavior {

    static stillValid(creep, data, catalog){
        return true;
    }

    static bid(creep, data, catalog){
        return 0;
    }

    static start(creep, data, catalog){
        return true;
    }

    static process(creep, data, catalog){
        var sayings = ['~biff~', 'bam!', 'zing'];
        var hostiles = catalog.hostiles[creep.pos.roomName];
        var hostileStructures = catalog.hostileStructures[creep.pos.roomName];
        
        var targetFlag = Game.flags[_.get(Memory, 'targetFlag', _.get(data, 'flag', 'Base'))];
        if(!targetFlag){
            targetFlag = Game.flags['Base'];
        }
        // console.log(targetFlag, _.get(Memory, 'targetFlag', _.get(data, 'flag', 'Base')));
        var manualTarget = _.get(Memory, 'manualTarget', false);
        var target = false;
        if(targetFlag && (creep.pos.roomName != targetFlag.pos.roomName || (hostiles.length < 1 && hostileStructures.length < 1 && !manualTarget))){
            if(creep.pos.getRangeTo(targetFlag) > 2){
                creep.moveTo(targetFlag);
            }
        }else if(manualTarget){
            target = Game.getObjectById(manualTarget);
            if(!target){
                Memory.manualTarget = false;
            }
        }else if(hostiles.length > 0){
            var enemies = _.sortBy(hostiles, (target)=>creep.pos.getRangeTo(target));
            target = enemies[0];
        }else if(hostileStructures.length > 0){
            var enemies = _.sortBy(hostileStructures, (target)=>creep.pos.getRangeTo(target));
            target = enemies[0];
        }
        if(target){
            var result = creep.attack(target);
            if(result == ERR_NOT_IN_RANGE) {
                creep.moveTo(target);
            }else if(result == OK){
                creep.say(sayings[Math.floor(Math.random()*sayings.length)]);
            }
        }
    }

    static end(creep, data, catalog){ }
};

class BaseFlagBehavior {

    stillValid(creep, data, catalog){
        return !!Game.flags[data.flag];
    }

    bid(creep, data, catalog){
        return !!Game.flags[data.flag];
    }

    start(creep, data, catalog){
        return !!Game.flags[data.flag];
    }

    process(creep, data, catalog){ }

    end(creep, data, catalog){ }
};

class ReserveBehavior extends BaseFlagBehavior {

    process(creep, data, catalog){
        var claimFlag = Game.flags[data.flag];
        if(claimFlag){
            if(creep.pos.roomName != claimFlag.pos.roomName){
                creep.moveTo(claimFlag);
            }else{
                var result = creep.reserveController(creep.room.controller);
                if(result == ERR_NOT_IN_RANGE){
                    creep.moveTo(creep.room.controller);
                }
            }
        }
    }
};

class ClaimBehavior extends BaseFlagBehavior {

    process(creep, data, catalog){
        var claimFlag = Game.flags[data.flag];
        if(claimFlag){
            if(creep.pos.roomName != claimFlag.pos.roomName){
                creep.moveTo(claimFlag);
            }else{
                var result = creep.claimController(creep.room.controller);
                if(result == ERR_NOT_IN_RANGE){
                    creep.moveTo(creep.room.controller);
                }else if(result == OK){
                    console.log("Claimed room", creep.pos.roomName);
                    claimFlag.remove();
                }
            }
        }
    }
};

class NOP extends BaseBehavior {
    constructor(){ super('none'); }
};

class DropBehavior extends BaseBehavior {
    constructor(){ super('drop'); }

    stillValid(creep, data, catalog){
        return RoomUtil.getEnergyPercent(creep) > 0.75;
    }

    bid(creep, data, catalog){
        return 1 - RoomUtil.getEnergyPercent(creep) + _.get(data, 'priority', 0);
    }

    start(creep, data, catalog){
        return true;
    }

    process(creep, data, catalog){
        creep.drop(RESOURCE_ENERGY);
    }
};

class PickupBehavior extends RemoteBaseBehavior {
    constructor(){ super('pickup'); }

    stillValid(creep, data, catalog){
        if(super.stillValid(creep, data, catalog)){
            return true;
        }
        var target = this.target(creep);
        return target && target.pos.roomName == creep.pos.roomName && RoomUtil.getEnergy(target) > 0 && RoomUtil.getEnergyPercent(creep) < 0.9;
    }

    bid(creep, data, catalog){
        var energy = RoomUtil.getEnergyPercent(creep);
        if(energy < 0.2 && super.bid(creep, data, catalog)){
            return energy;
        }
        if(energy > 0.75 || catalog.getAvailableEnergy(creep) < 1){
            return false;
        }
        return energy * 2;
    }

    start(creep, data, catalog){
        if(super.start(creep, data, catalog)){
            return true;
        }
        this.setTrait(creep, _.get(catalog.getEnergyContainers(creep, data.containerTypes), '[0].id', false));
        return !!this.target(creep);
    }

    process(creep, data, catalog){
        if(super.process(creep, data, catalog)){
            return;
        }
        var target = this.target(creep);
        if(target.resourceType && target.resourceType == RESOURCE_ENERGY){
            var result = creep.pickup(target);
            if(result == ERR_NOT_IN_RANGE) {
                creep.moveTo(target);
            }
        }else{
            var result = creep.withdraw(target, RESOURCE_ENERGY, Math.min(creep.carryCapacity - creep.carry.energy, RoomUtil.getEnergy(target)));
            if(result == ERR_NOT_IN_RANGE) {
                creep.moveTo(target);
            }
        }
    }
};

class CollectBehavior {

    static stillValid(creep, data, catalog){
        var target = Game.getObjectById(creep.memory.traits.collect);
        return creep.carry.energy < creep.carryCapacity && target && target.carry.energy > target.carryCapacity * 0.25;
    }

    static bid(creep, data, catalog){
        var miners = creep.room.find(FIND_MY_CREEPS, {
            filter: (target)=>target.memory.class == "miner"
        });
        if(miners.length < 1){
            return false;
        }
        return creep.carry.energy / creep.carryCapacity + (data.priority || 0);
    }

    static start(creep, data, catalog){
        var miners = creep.room.find(FIND_MY_CREEPS, {
            filter: (target)=>target.memory.class == "miner"
        });
        
        creep.memory.traits.collect = _.get(_.first(_.sortBy(miners, (miner)=>(1 - miner.carry.energy / miner.carryCapacity) + CollectBehavior.getCollectorCount(miner.id, catalog))), 'id');
        return RoomUtil.exists(creep.memory.traits.collect);
    }

    static process(creep, data, catalog){
        var miner = Game.getObjectById(creep.memory.traits.collect);
        if(creep.pos.getRangeTo(miner) > 1){
            creep.moveTo(miner);
        }
    }

    static end(creep, data, catalog){
        creep.memory.traits.collect = false;
    }

    static getCollectorCount(id, catalog){
        var counted = _.countBy(catalog.traits.collect);
        if(counted[id]){
            return counted[id];
        }
        return 0;
    }
};

var behaviors = {
    attack: AttackBehavior,
    defend: new NOP(),
    build: new BuildBehavior(),
    collect: CollectBehavior,
    emergencydeliver: new EmergencyDeliver(),
    deliver: new DeliverBehavior(),
    drop: new DropBehavior(),
    mining: new MiningBehavior(),
    repair: new RepairBehavior(),
    upgrade: new UpgradeBehavior(),
    claim: new ClaimBehavior(),
    reserve: new ReserveBehavior(),
    pickup: new PickupBehavior()
};

class Behavior {

    static process(catalog){
        _.forEach(Game.creeps, creep => Behavior.processCreep(creep, catalog));
    }

    static idle(creep, targetGameTime){
        creep.memory.action = 'idle';
        creep.memory.traits.idle = targetGameTime;
    }

    static processCreep(creep, catalog){
        if(creep.memory.action && !behaviors[creep.memory.action].stillValid(creep, creep.memory.behaviors[creep.memory.action], catalog)){
            if(!behaviors[creep.memory.action].end){
                console.log('missing end method', creep.memory.action, creep.name);
                return;
            }

            //DEBUG
            if(Memory.debugType == creep.memory.type) console.log(creep, 'ending', creep.memory.action);

            behaviors[creep.memory.action].end(creep, creep.memory.behaviors[creep.memory.action], catalog);
            catalog.removeTrait(creep, creep.memory.action);
            creep.memory.action = false;
        }
        if(!creep.memory.action){
            var lowestBid = false;
            var lowestBidder = false;
            _.forEach(creep.memory.behaviors, (data, name) =>{
                if(!behaviors[name] || !behaviors[name].bid){
                    console.log(name, creep.name, data[name]);
                    return;
                }
                var bid = behaviors[name].bid(creep, data, catalog);
                if(bid === false){
                    return;
                }
                //DEBUG
                if(Memory.debugType == creep.memory.type) console.log(creep, bid, name, data, lowestBid, lowestBidder);
                if(lowestBid === false || bid < lowestBid){
                    lowestBid = bid;
                    lowestBidder = name;
                }
            });
            if(lowestBid !== false){
                var started = behaviors[lowestBidder].start(creep, creep.memory.behaviors[lowestBidder], catalog);
                //DEBUG
                if(Memory.debugType == creep.memory.type) console.log(creep, 'starting', lowestBidder, lowestBid, started, creep.memory.traits[lowestBidder]);
                if(started){
                    creep.memory.action = lowestBidder;
                    catalog.addTrait(creep, lowestBidder, creep.memory.traits[lowestBidder]);
                }else{
                    //DEBUG
                    if(Memory.debugType == creep.memory.type) console.log("Failed to start!", creep, lowestBidder);
                    behaviors[lowestBidder].end(creep, creep.memory.behaviors[lowestBidder], catalog);
                    catalog.removeTrait(creep, lowestBidder);
                }
            }
        }
        if(creep.memory.action === 'idle'){
            if(Game.time >= _.get(creep.memory, 'traits.idle')){
                creep.memory.action = false;
                creep.memory.traits.idle = false;
            }
        }else if(creep.memory.action){
            behaviors[creep.memory.action].process(creep, creep.memory.behaviors[creep.memory.action], catalog);
        }
    }

}

module.exports = Behavior;