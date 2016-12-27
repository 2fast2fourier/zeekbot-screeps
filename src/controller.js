"use strict";

var RoomUtil = require('./roomutil');

class Controller {

    static control(catalog){
        var towers = _.filter(Game.structures, {structureType: STRUCTURE_TOWER});
        towers.forEach((tower, ix) => {
            if(!Memory.standDown && !Controller.towerDefend(tower, catalog)){
                if(!Controller.towerHeal(tower, catalog) && tower.energy > tower.energyCapacity * 0.75){
                    Controller.towerRepair(tower, catalog, ix);
                }
            }
        });

        _.forEach(Memory.linkTransfer, (target, source) => Controller.linkTransfer(source, target, catalog));
        _.forEach(Memory.react, (data, labId) => Controller.runReaction(Game.getObjectById(labId), data, catalog));
    }

    static towerDefend(tower, catalog) {
        var hostiles = catalog.getHostileCreeps(tower.room);
        var healer = _.first(hostiles, creep => !!_.find(creep.body, part => part.type == HEAL));
        if(healer){
            return tower.attack(healer) == OK;
        }
        if(hostiles.length > 0) {
            var enemies = _.sortBy(hostiles, (target)=>tower.pos.getRangeTo(target));
            return tower.attack(enemies[0]) == OK;
        }
        return false;
    }

    static towerHeal(tower, catalog) {
        var injuredCreeps = _.filter(catalog.getCreeps(tower.room), creep => creep.hits < creep.hitsMax);
        if(injuredCreeps.length > 0) {
            var injuries = _.sortBy(injuredCreeps, creep => creep.hits / creep.hitsMax);
            return tower.heal(injuries[0]) == OK;
        }
        return false;
    }

    static towerRepair(tower, catalog, ix) {
        var damagedBuildings = _.filter(catalog.getStructures(tower.room), structure => structure.hits < Math.min(structure.hitsMax, Memory.settings.repairTarget) * Memory.settings.towerRepairPercent);
        if(damagedBuildings.length > ix) {
            var damaged = _.sortBy(damagedBuildings, structure => structure.hits / Math.min(structure.hitsMax, Memory.settings.repairTarget));
            tower.repair(damaged[ix]);
        }
    }

    static linkTransfer(sourceId, targetId, catalog){
        var minimumNeed = 50;
        var source = Game.getObjectById(sourceId);
        var target;
        if(_.isObject(targetId)){
            target = Game.getObjectById(targetId.target);
            minimumNeed = targetId.minimumNeed || 50;
        }else{
            target = Game.getObjectById(targetId);
        }
        if(!source || !target){
            console.log('invalid linkTransfer', source, target);
            return false;
        }
        var need = catalog.getAvailableCapacity(target);
        var sourceEnergy = catalog.getResource(source, RESOURCE_ENERGY);
        if(source && need >= minimumNeed && source.cooldown == 0 && need > 0 && sourceEnergy > 0){
            source.transferEnergy(target, Math.min(sourceEnergy, need));
        }
    }

    static runReaction(lab, data, catalog){
        if(lab && (lab.cooldown > 0 || lab.mineralAmount == lab.mineralCapacity)){
            return;
        }
        var srcA = Game.getObjectById(data[0]);
        var srcB = Game.getObjectById(data[1]);
        if(!lab || !srcA || !srcB){
            console.log('invalid reaction', lab, srcA, srcB);
            return;
        }
        if(srcA.mineralAmount == 0 || srcB.mineralAmount == 0){
            return;
        }
        lab.runReaction(srcA, srcB);
    }
}

module.exports = Controller;