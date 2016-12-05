"use strict";

var RoomUtil = require('./roomutil');

class Controller {

    static control(catalog){
        var towers = _.filter(Game.structures, {structureType: STRUCTURE_TOWER});
        towers.forEach(tower => {
            if(!Memory.standDown && !Controller.towerDefend(tower, catalog)){
                if(!Controller.towerHeal(tower, catalog) && tower.energy > tower.energyCapacity * 0.75){
                    Controller.towerRepair(tower, catalog)
                }
            }
        });

        _.forEach(Memory.linkTransfer, (target, source) => Controller.linkTransfer(Game.getObjectById(source), Game.getObjectById(target)));
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

    static towerRepair(tower, catalog) {
        var damagedBuildings = _.filter(catalog.buildings[tower.room.name], structure => structure.hits < structure.hitsMax && structure.hits < Memory.settings.towerRepairThreshold);
        if(damagedBuildings.length > 0) {
            var damaged = _.sortBy(damagedBuildings, structure => structure.hits / structure.hitsMax);
            tower.repair(damaged[0]);
        }
    }

    static linkTransfer(source, target){
        var need = RoomUtil.getEnergyDeficit(target);
        if(source && need >= 50 && source.cooldown == 0 && need > 0 && RoomUtil.getEnergy(source) > 0){
            source.transferEnergy(target, Math.min(RoomUtil.getEnergy(source), need));
        }
    }
}

module.exports = Controller;