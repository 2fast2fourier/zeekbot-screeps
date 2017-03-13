"use strict";

const Util = require('./util');
const roomRegex = /([WE])(\d+)([NS])(\d+)/;

class Controller {

    static hegemony(){
        if(Game.interval(20)){
            var buildFlags = Flag.getByPrefix('Build');
            _.forEach(buildFlags, flag => Controller.buildFlag(flag));

            Controller.levelTerminals();
        }
    }

    static control(cluster){

        var scanner = Game.getObjectById(cluster.scanner);
        if(scanner){
            var scanPos = roomRegex.exec(scanner.pos.roomName);
            if(scanPos){
                var lastX = (Game.time % 18) - 9 + parseInt(scanPos[2]);
                var lastY = Math.floor((Game.time % 324) / 18) - 9 + parseInt(scanPos[4]);
                var scanRoom = Game.rooms[scanPos[1]+lastX+scanPos[3]+lastY];
                if(scanRoom){
                    var owner = _.get(scanRoom, 'controller.owner.username');
                    var reserved = _.get(scanRoom, 'controller.reservation.username');
                    if(owner && !scanRoom.controller.my){
                        Memory.avoidRoom[scanRoom.name] = true;
                    }else if(reserved && reserved != 'Zeekner'){
                        Memory.avoidRoom[scanRoom.name] = true;
                    }else{
                        delete Memory.avoidRoom[scanRoom.name];
                    }
                }

                var targetX = ((Game.time + 1) % 18) - 9 + parseInt(scanPos[2]);
                var targetY = Math.floor(((Game.time % 324) + 1) / 18) - 9 + parseInt(scanPos[4]);
                var queueRoom = scanPos[1]+targetX+scanPos[3]+targetY;
                scanner.observeRoom(queueRoom);
            }
        }

        _.forEach(cluster.structures.tower, tower=>{
            let action = false;
            if(tower.energy >= 10){
                let hostile = _.first(cluster.find(tower.room, FIND_HOSTILE_CREEPS));
                if(hostile){
                    action = tower.attack(hostile) == OK;
                }
                if(!action && Game.interval(5)){
                    let hurtCreep = _.first(_.filter(cluster.find(tower.room, FIND_MY_CREEPS), creep => creep.hits < creep.hitsMax));
                    if(hurtCreep){
                        tower.heal(hurtCreep);
                    }
                }
            }
        });

        if(Game.interval(10)){
            Controller.linkTransfer(cluster);

            _.forEach(cluster.reaction, (data, type) => Controller.runReaction(cluster, type, data));
        }
    }

    static buildFlag(flag){
        if(!flag.room || !flag.room.hasCluster()){
            Game.note('buildFlagUnknownRoom', 'buildflag in unknown room: ' + flag.pos);
            flag.remove();
            return;
        }
        let cluster = flag.room.getCluster();
        var args = flag.name.split('-');
        var type = args[1];
        if(!_.has(CONSTRUCTION_COST, type)){
            console.log('unknown buildflag', type);
            Game.note('buildFlagUnknown', 'Unknown buildflag: ' + type + '-' + flag.pos);
            flag.remove();
        }
        var rcl = _.get(flag, 'room.controller.level', 0);
        let count = _.size(cluster.getStructuresByType(flag.room, type));
        count += _.size(_.filter(cluster.find(flag.room, FIND_MY_CONSTRUCTION_SITES), site => site.structureType == type));
        if(_.get(CONTROLLER_STRUCTURES, [type, rcl], 0) > count){
            console.log('Building', type, 'at', flag.pos, rcl);
            var result = flag.pos.createConstructionSite(type);
            if(result == OK){
                flag.remove();
            }else{
                Game.note('buildFlagFailed', 'Failed to buildFlag: ' + type + '-' + flag.pos);
            }
        }
    }

    //// Links ////

    static linkTransfer(cluster){
        let tags = cluster.getTaggedStructures();
        let linkInput = _.groupBy(tags.input, 'pos.roomName');
        _.forEach(tags.output, target => {
            if(target.energy < target.energyCapacity - 50){
                let sources = _.filter(linkInput[target.pos.roomName] || [], link => link.energy > 50 && link.cooldown == 0);
                if(sources.length > 0){
                    let source = _.first(_.sortBy(sources, src => -src.energy));
                    source.transferEnergy(target, Math.min(source.energy, target.energyCapacity - target.energy));
                }
            }
        });
    }

    //// Terminals ////

    static levelTerminals(){
        let transferred = {};
        let terminals = Game.hegemony.structures.terminal;
        let terminalCount = terminals.length;
        let ideal = 5000;
        let idealTotal = ideal * terminalCount;
        _.forEach(Game.hegemony.resources, (data, type)=>{
            if(type == RESOURCE_ENERGY || data.stored < ideal){
                return;
            }

            let needed = _.filter(terminals, terminal => terminal.getResource(type) < ideal - 100);
            let excess = _.filter(terminals, terminal => !transferred[terminal.id] && terminal.getResource(type) > ideal + 100 && terminal.getResource(RESOURCE_ENERGY) > 20000);
            if(needed.length > 0 && excess.length > 0){
                let source = _.last(Util.sort.resource(type, excess));
                let destination = _.first(Util.sort.resource(type, needed));
                let sourceAmount = source.getResource(type);
                var destinationAmount = destination.getResource(type);
                var sending = Math.min(sourceAmount - ideal, ideal - destinationAmount);
                if(sending >= 100){
                    console.log('Transferring', sending, type, 'from', source.pos.roomName, 'to', destination.pos.roomName);
                    transferred[source.id] = source.send(type, sending, destination.pos.roomName) == OK;
                    return;
                }
            }
        });
        return transferred;
    }

    //// Reactions ////

    static runReaction(cluster, type, data){
        var labSet = data.lab;
        var labs = Game.getObjects(cluster.labs[data.lab]);
        for(var ix=2;ix<labs.length;ix++){
            Controller.react(type, labs[ix], labs[0], labs[1], data.components);
        }
    }

    static react(type, targetLab, labA, labB, components){
        if(!targetLab || !labA || !labB){
            Game.note('labnotify', 'invalid lab for reaction: ' + type);
            return false;
        }
        if(targetLab.cooldown > 0 || targetLab.mineralAmount == targetLab.mineralCapacity){
            return;
        }
        if(labA.mineralType != components[0] || labB.mineralType != components[1]){
            return;
        }
        if(labA.mineralAmount == 0 || labB.mineralAmount == 0){
            return;
        }
        targetLab.runReaction(labA, labB);
    }

    // static towerDefend(tower, catalog, targets) {
    //     var hostiles = _.filter(targets, target => tower.pos.roomName == target.pos.roomName);
    //     if(hostiles.length == 0){
    //         return false;
    //     }
    //     var healer = _.find(hostiles, creep => creep.getActiveBodyparts(HEAL) > 0);
    //     if(healer){
    //         return tower.attack(healer) == OK;
    //     }
    //     if(hostiles.length > 0) {
    //         var enemies = _.sortBy(hostiles, (target)=>tower.pos.getRangeTo(target));
    //         return tower.attack(enemies[0]) == OK;
    //     }
    //     return false;
    // }

    // static towerHeal(tower, catalog, creeps) {
    //     var injuredCreeps = _.filter(creeps, target => tower.pos.roomName == target.pos.roomName);
    //     if(injuredCreeps.length > 0) {
    //         var injuries = _.sortBy(injuredCreeps, creep => creep.hits / creep.hitsMax);
    //         return tower.heal(injuries[0]) == OK;
    //     }
    //     return false;
    // }

    // static towerRepair(tower, catalog, repairTargets) {
    //     if(!tower){
    //         Util.notify('towerbug', 'missing tower somehow!?');
    //         return;
    //     }
    //     var targets = _.filter(repairTargets, target => tower && target && tower.pos.roomName == target.pos.roomName);
    //     if(targets.length > 0) {
    //         var damaged = _.sortBy(targets, structure => structure.hits / Math.min(structure.hitsMax, Memory.settings.repairTarget));
    //         tower.repair(damaged[0]);
    //     }
    // }

    // static boost(type, labId){
    //     Memory.transfer.lab[labId] = type;
    //     var lab = Game.getObjectById(labId);
    //     if(!lab){
    //         delete Memory.production.boosts[labId];
    //         Game.notify('Boost Lab no longer valid: '+labId + ' - ' + type);
    //         return;
    //     }
    //     if(lab.mineralType == type && lab.mineralAmount > 500 && lab.energy > 500){
    //         if(!Memory.boost.labs[type]){
    //             Memory.boost.labs[type] = [];
    //             Memory.boost.rooms[type] = [];
    //         }
    //         Memory.boost.stored[type] = _.get(Memory.boost.stored, type, 0) + lab.mineralAmount;
    //         Memory.boost.labs[type].push(lab.id);
    //         Memory.boost.rooms[type].push(lab.pos.roomName);
    //     }
    // }

// {
// 	id : "55c34a6b5be41a0a6e80c68b", 
// 	created : 13131117, 
// 	active: true,
// 	type : "sell"    
// 	resourceType : "OH", 
// 	roomName : "W1N1", 
// 	amount : 15821, 
// 	remainingAmount : 30000,
// 	totalAmount : 50000,
// 	price : 2.95    
// }
    // static sellOverage(catalog){
    //     var sold = false;
    //     var terminalCount = _.size(catalog.buildings.terminal);
    //     var ideal = Memory.settings.terminalIdealResources;
    //     var max = terminalCount * ideal;
    //     var orders = {};
    //     _.forEach(Game.market.orders, order =>{
    //         if(order.active && order.type == ORDER_SELL){
    //             orders[order.resourceType] = order;
    //         }
    //     });
    //     _.forEach(catalog.resources, (data, type)=>{
    //         var overage = data.totals.terminal - max;
    //         if(!sold && type != RESOURCE_ENERGY && overage > 20000 && Game.market.credits > 10000 && data.totals.storage > 50000){
    //             if(!_.has(prices, type)){
    //                 console.log('want to sell', type, 'but no price');
    //                 return;
    //             }
    //             var existing = orders[type];
    //             if(!existing){
    //                 var source = _.first(_.sortBy(data.terminal, terminal => -Util.getResource(terminal, type)));
    //                 var holding = Util.getResource(source, type);
    //                 console.log('selling from', source.pos.roomName, overage, holding, prices[type]);
    //                 sold = Game.market.createOrder(ORDER_SELL, type, prices[type], Math.min(overage, holding), source.pos.roomName) == OK;
    //                 if(sold){
    //                     console.log('created order', type, Math.min(overage, holding));
    //                 }
    //             }else if(existing && existing.remainingAmount < 250){
    //                 console.log('cancelling order', existing.orderId, existing.remainingAmount, overage);
    //                 sold = Game.market.cancelOrder(existing.orderId) == OK;
    //             }

    //         }
    //     });
    // }
}

module.exports = Controller;