"use strict";

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
        _.forEach(Memory.react, (data, type) => Controller.runReaction(type, data, catalog));
        _.forEach(Memory.boost.labs, (labId, type) => Controller.boost(catalog, type, labId));
    }

    static towerDefend(tower, catalog) {
        var hostiles = catalog.getHostileCreeps(tower.room);
        var healer = _.find(hostiles, creep => creep.getActiveBodyparts(HEAL) > 0);
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

    static runReaction(type, data, catalog){
        var labs = _.map(Memory.production.labs[data.lab], labId => Game.getObjectById(labId));
        var targetLab = labs[2];
        if(!_.every(labs) || !targetLab){
            console.log('missing labs for reaction', labs, type, data.lab);
            return;
        }

        Memory.transfer.lab[targetLab.id] = type;

        if(targetLab.cooldown > 0 || targetLab.mineralAmount == targetLab.mineralCapacity){
            return;
        }
        if(labs[0].mineralType != data.components[0] || labs[1].mineralType != data.components[1]){
            return;
        }
        if(labs[0].mineralAmount == 0 || labs[1].mineralAmount == 0){
            return;
        }
        targetLab.runReaction(labs[0], labs[1]);
    }

    static boost(catalog, type, labId){
        var lab = Game.getObjectById(labId);
        if(!lab){
            console.log('invalid lab');
            return;
        }
        Memory.transfer.lab[lab.id] = type;
        if(lab.mineralType != type){
            // console.log('wrong resources', lab, lab.mineralType, ' != ', type);
            Memory.boost.stored[type] = 0;
            return;
        }
        if(lab.mineralAmount < 50 || lab.energy < 50){
            // console.log('missing resources', lab, lab.energy, lab.mineralAmount);
            Memory.boost.stored[type] = 0;
            return;
        }
        Memory.boost.stored[type] = lab.mineralAmount;
        
    }
}

module.exports = Controller;