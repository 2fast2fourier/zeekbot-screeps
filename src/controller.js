"use strict";

var Util = require('./util');

var prices = {
    X: 0.45
}

class Controller {

    static control(catalog){
        var towers = catalog.buildings.tower;
        var targets = _.map(catalog.jobs.jobs['defend'], 'target');
        var healCreeps = _.map(catalog.jobs.jobs['heal'], 'target');
        var repairTargets = Util.getObjects(Memory.jobs.repair);
        towers.forEach((tower, ix) => {
            if(!Controller.towerDefend(tower, catalog, targets)){
                if(!Controller.towerHeal(tower, catalog, healCreeps) && tower.energy > tower.energyCapacity * 0.75){
                    Controller.towerRepair(tower, catalog, repairTargets);
                }
            }
        });


        if(Util.interval(10)){
            Memory.transfer.reactions = {};
            _.forEach(Memory.linkTransfer, (target, source) => Controller.linkTransfer(source, target, catalog));
            _.forEach(Memory.react, (data, type) => Controller.runReaction(type, data, catalog));
        }

        if(Util.interval(10) || Memory.boost.update){
            Controller.boost(catalog, catalog.buildings.lab);
            Memory.boost.update = false;
        }
        

        if(Util.interval(20)){
            if(!Controller.levelTerminals(catalog)){
                Controller.sellOverage(catalog);
            }
        }
    }

    static towerDefend(tower, catalog, targets) {
        var hostiles = _.filter(targets, target => tower.pos.roomName == target.pos.roomName);
        if(hostiles.length == 0){
            return false;
        }
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

    static towerHeal(tower, catalog, creeps) {
        var injuredCreeps = _.filter(creeps, target => tower.pos.roomName == target.pos.roomName);
        if(injuredCreeps.length > 0) {
            var injuries = _.sortBy(injuredCreeps, creep => creep.hits / creep.hitsMax);
            return tower.heal(injuries[0]) == OK;
        }
        return false;
    }

    static towerRepair(tower, catalog, repairTargets) {
        if(!tower){
            Util.notify('towerbug', 'missing tower somehow!?');
            return;
        }
        var targets = _.filter(repairTargets, target => tower && target && tower.pos.roomName == target.pos.roomName && target.hits < Math.min(target.hitsMax, Memory.settings.repairTarget));
        if(targets.length > 0) {
            var damaged = _.sortBy(targets, structure => structure.hits / Math.min(structure.hitsMax, Memory.settings.repairTarget));
            tower.repair(damaged[0]);
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

    // Memory.react[type] = {
    //     lab: labNum,
    //     deficit: reaction.deficit,
    //     components: reaction.components,
    //     children: reaction.children,
    //     size: reaction.size,
    //     allComponents: reaction.allComponents,
    //     full: fullReaction,
    //     assignments
    // };

    static runReaction(type, data, catalog){
        var labs = Util.getObjects(Memory.production.labs[data.lab]);
        Controller.react(type, labs[data.assignments[type]], labs[data.assignments[data.components[0]]], labs[data.assignments[data.components[1]]], data.components);
        if(data.full){
            _.forEach(data.children, (child, component)=>Controller.runChildReaction(component, data, child, labs));
        }
    }

    static runChildReaction(component, parent, child, labs){
        // console.log('running reactions for child', component);
        Controller.react(component, labs[parent.assignments[component]], labs[parent.assignments[child.components[0]]], labs[parent.assignments[child.components[1]]], child.components);
        _.forEach(child.children, (child, component)=>Controller.runChildReaction(component, data, child, labs));
    }

    static registerReaction(type, roomName){
        if(!Memory.transfer.reactions[type]){
            Memory.transfer.reactions[type] = [];
        }
        if(!_.includes(Memory.transfer.reactions[type], roomName)){
            Memory.transfer.reactions[type].push(roomName);
        }
    }

    static react(type, targetLab, labA, labB, components){
        if(!targetLab || !labA || !labB){
            Util.notify('labnotify', 'invalid lab for reaction' + type);
            return false;
        }
        var roomName = targetLab.pos.roomName;
        _.forEach(components, component => Controller.registerReaction(component, roomName));
        if(targetLab.cooldown > 0 || targetLab.mineralAmount == targetLab.mineralCapacity){
            return;
        }
        if(labA.mineralType != components[0] || labB.mineralType != components[1]){
            return;
        }
        if(labA.mineralAmount == 0 || labB.mineralAmount == 0){
            return;
        }
        // console.log('running reactions for', type, targetLab.pos.roomName);
        targetLab.runReaction(labA, labB);
    }

    static boost(catalog, labs){
        Memory.boost.stored = {};
        Memory.boost.labs = {};
        Memory.boost.rooms = {};
        _.forEach(labs, lab => {
            var type = lab.mineralType;
            if(type && type.startsWith('X') && type.length > 1 && lab.mineralAmount > 50 && lab.energy > 50){
                if(!Memory.boost.labs[type]){
                    Memory.boost.labs[type] = [];
                    Memory.boost.rooms[type] = [];
                }
                Memory.boost.stored[type] = _.get(Memory.boost.stored, type, 0) + lab.mineralAmount;
                Memory.boost.labs[type].push(lab.id);
                Memory.boost.rooms[type].push(lab.pos.roomName);
            }
        });
    }

    static levelTerminals(catalog){
        var transferred = false;
        var ideal = Memory.settings.terminalIdealResources;
        var terminalCount = _.size(catalog.buildings.terminal);
        _.forEach(catalog.resources, (data, type)=>{
            if(type == RESOURCE_ENERGY || transferred){
                return;
            }
            var reactions = Memory.transfer.reactions[type];
            if(data.totals.terminal > 100 && data.totals.terminal < ideal * terminalCount){
                _.forEach(reactions, roomName=>{
                    if(transferred){
                        return;
                    }
                    var room = Game.rooms[roomName];
                    var targetTerminal = room.terminal;
                    var resources = Util.getResource(targetTerminal, type);
                    if(targetTerminal && resources < ideal - 100 && resources < data.totals.terminal - 100){
                        var source = _.last(Util.sort.resource(_.filter(data.terminal, terminal => !_.includes(reactions, terminal.pos.roomName) && Util.getResource(terminal, type) > 100 && Util.getResource(terminal, RESOURCE_ENERGY) > 20000), type));
                        if(source){
                            var src = Util.getResource(source, type);
                            var dest = Util.getResource(targetTerminal, type);
                            var sending = Math.min(src, ideal - dest);
                            if(sending > 100){
                                console.log('transfer need', type, sending, source, 'to', targetTerminal);
                                transferred = source.send(type, sending, targetTerminal.pos.roomName) == OK;
                            }
                        }
                    }
                });
            }

            if(!transferred && data.totals.terminal > ideal){
                var terminal = _.last(Util.sort.resource(_.filter(data.terminal, terminal => Util.getResource(terminal, type) > ideal + 100 && Util.getResource(terminal, RESOURCE_ENERGY) > 40000), type));
                var targets = _.filter(catalog.buildings.terminal, entity => Util.getResource(entity, type) < ideal - 100);
                var target = _.first(Util.sort.resource(targets, type));
                if(terminal && target){
                    var source = Util.getResource(terminal, type);
                    var dest = Util.getResource(target, type);
                    var sending = Math.min(source - ideal, ideal - dest);
                    if(sending >= 100){
                        console.log('transfer', type, terminal, source, 'to', target, dest, sending);
                        transferred = terminal.send(type, sending, target.pos.roomName) == OK;
                        return;
                    }
                }
            }
        });
        return transferred;
    }

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
    static sellOverage(catalog){
        var sold = false;
        var terminalCount = _.size(catalog.buildings.terminal);
        var ideal = Memory.settings.terminalIdealResources;
        var max = terminalCount * ideal;
        var orders = {};
        _.forEach(Game.market.orders, order =>{
            if(order.active && order.type == ORDER_SELL){
                orders[order.resourceType] = order;
            }
        });
        _.forEach(catalog.resources, (data, type)=>{
            var overage = data.totals.terminal - max;
            if(!sold && type != RESOURCE_ENERGY && overage > 20000 && Game.market.credits > 10000 && data.totals.storage > 50000){
                if(!_.has(prices, type)){
                    console.log('want to sell', type, 'but no price');
                    return;
                }
                var existing = orders[type];
                if(!existing){
                    var source = _.first(_.sortBy(data.terminal, terminal => -Util.getResource(terminal, type)));
                    var holding = Util.getResource(source, type);
                    console.log('selling from', source.pos.roomName, overage, holding, prices[type]);
                    sold = Game.market.createOrder(ORDER_SELL, type, prices[type], Math.min(overage, holding), source.pos.roomName) == OK;
                    if(sold){
                        console.log('created order', type, Math.min(overage, holding));
                    }
                }else if(existing && existing.remainingAmount < 250){
                    console.log('cancelling order', existing.orderId, existing.remainingAmount, overage);
                    sold = Game.market.cancelOrder(existing.orderId) == OK;
                }

            }
        });
    }
}

module.exports = Controller;