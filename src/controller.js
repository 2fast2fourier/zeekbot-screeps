"use strict";

const Util = require('./util');
const roomRegex = /([WE])(\d+)([NS])(\d+)/;
const ENERGY_TRANSFER_AMOUNT = 20000;

const autobuyPriceLimit = {
    H: 0.3,
    O: 0.25,
    XKHO2: 1.5,
    XZHO2: 1.5
};

class Controller {

    static federation(allocated){
        if(Game.interval(10)){
            _.forEach(Game.flags, flag =>{
                if(!flag.room){
                    Memory.observe[flag.pos.roomName] = Game.time + 98;
                    console.log('Observing', flag.pos.roomName);
                }
            });
        }
        if(Game.interval(20)){
            var buildFlags = Flag.getByPrefix('Build');
            _.forEach(buildFlags, flag => Controller.buildFlag(flag));

            var transferred = Controller.levelTerminals();
            Controller.terminalEnergy(transferred);
            Controller.emptyTerminals();
        }

        var observers = _.filter(Game.federation.structures.observer, struct => !_.includes(allocated, struct.id));
        var portalWatch = Flag.getByPrefix('PortalWatch');
        if(portalWatch.length && observers.length > 0){
            for(var flag of portalWatch){
                var roomName = flag.pos.roomName;
                let observer = _.min(observers, ob => Game.map.getRoomLinearDistance(roomName, ob.pos.roomName));
                if(observer && observer.pos && Game.map.getRoomLinearDistance(roomName, observer.pos.roomName) < 10){
                    _.pull(observers, observer);
                    if(observer.observeRoom(roomName) == OK){
                        new RoomVisual(roomName).text('PortalWatch Observed by '+observer.pos.roomName, 25, 25);
                        if(Memory.observe[roomName]){
                            delete Memory.observe[roomName];
                        }
                    }
                }else{
                    console.log('PW No observer for', roomName);
                }
                if(flag.room){
                    let room = flag.room;
                    let matrix = room.matrix;
                    if(matrix.creeps.player){
                        Game.note('portalWarn'+room.name, 'Warning: Player creeps detected: ' + room.name);
                    }
                }
            }
        }

        if(_.size(Memory.observe) > 0){
            for(let roomName in Memory.observe){
                if(observers.length > 0){
                    let observer = _.min(observers, ob => Game.map.getRoomLinearDistance(roomName, ob.pos.roomName));
                    if(observer && observer.pos && Game.map.getRoomLinearDistance(roomName, observer.pos.roomName) < 10){
                        _.pull(observers, observer);
                        if(observer.observeRoom(roomName) == OK){
                            new RoomVisual(roomName).text('Observed by '+observer.pos.roomName, 25, 25);
                        }
                    }else{
                        console.log('No observer for', roomName);
                    }
                }
            }
        }

        if(Game.intervalOffset(50, 11)){
            Controller.autobuyResources();
        }
    }

    static control(cluster, allocated){

        var scanner = Game.getObjectById(cluster.scanner);
        if(scanner){
            allocated.push(scanner.id);
            var scanPos = roomRegex.exec(scanner.pos.roomName);
            if(scanPos){
                var lastX = (Game.time % 18) - 9 + parseInt(scanPos[2]);
                var lastY = Math.floor((Game.time % 324) / 18) - 9 + parseInt(scanPos[4]);
                var scanRoom = Game.rooms[scanPos[1]+lastX+scanPos[3]+lastY];
                if(scanRoom){
                    var owner = _.get(scanRoom, 'controller.owner.username');
                    var reserved = _.get(scanRoom, 'controller.reservation.username');
                    if(owner && !scanRoom.controller.my){
                        let buildings = scanRoom.find(FIND_HOSTILE_STRUCTURES);
                        if(buildings.length > 5){
                            Memory.avoidRoom[scanRoom.name] = true;
                        }else{
                            delete Memory.avoidRoom[scanRoom.name];
                        }
                    }else if(reserved && reserved != 'Zeekner'){
                        Memory.avoidRoom[scanRoom.name] = true;
                    }else if(!scanRoom.controller){
                        let buildings = scanRoom.find(FIND_HOSTILE_STRUCTURES);
                        if(buildings.length > 3){
                            Memory.avoidRoom[scanRoom.name] = true;
                        }else{
                            delete Memory.avoidRoom[scanRoom.name];
                        }
                    }else{
                        delete Memory.avoidRoom[scanRoom.name];
                    }
                }

                var targetX = ((Game.time + 1) % 18) - 9 + parseInt(scanPos[2]);
                var targetY = Math.floor(((Game.time + 1) % 324) / 18) - 9 + parseInt(scanPos[4]);
                var queueRoom = scanPos[1]+targetX+scanPos[3]+targetY;
                scanner.observeRoom(queueRoom);
            }
        }

        _.forEach(cluster.structures.tower, tower=>{
            let action = false;
            if(tower.room.memory.halt){
                return;
            }
            if(tower.energy >= 10){
                let data = Game.matrix.rooms[tower.pos.roomName];
                let hostile = data.target;
                if(data.targetted){
                    let best = Game.getObjectById(_.max(data.targetted, 'value').id);
                    if(best){
                        hostile = best;
                    }
                }
                if(data.damaged.length > 0){
                    action = tower.heal(_.first(data.damaged)) == OK;
                }
                if(!action && hostile){
                    action = tower.attack(hostile) == OK;
                }
                if(!action){
                    if(data.damaged.length > 0){
                        tower.heal(_.first(data.damaged));
                    }else if(Game.interval(20)){
                        let critStruct = _.first(_.sortBy(_.filter(cluster.find(tower.room, FIND_STRUCTURES), struct => struct.hits < 400), target => tower.pos.getRangeTo(target)));
                        if(critStruct){
                            tower.repair(critStruct);
                        }
                    }else if(Game.cpu.bucket > 9750 && tower.energy > tower.energyCapacity * 0.75 && _.get(tower, 'room.storage.store.energy', 0) > 300000){
                        var ramparts = _.filter(cluster.structures.rampart, rampart => rampart.pos.roomName == tower.pos.roomName && rampart.getDamage() > 0);
                        var target = Util.closest(tower, ramparts);
                        if(target && target.pos.getRangeTo(tower) < 10){
                            tower.repair(target);
                        }
                    }
                }
            }
        });

        if(Game.interval(10)){
            Controller.linkTransfer(cluster);

            _.forEach(cluster.reaction, (data, type) => Controller.runReaction(cluster, type, data));
        }
        if(Game.interval(500)){
            Controller.scanForNukes(cluster);
        }
    }

    static buildFlag(flag){
        if(!flag.room){
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
        let linkInput = _.groupBy(cluster.tagged.input, 'pos.roomName');
        _.forEach(_.without(cluster.structures.link, cluster.tagged.input), target => {
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
    static terminalEnergy(transferred){
        let overfill = _.filter(Game.federation.structures.terminal, terminal => terminal.store.energy < 100000 && _.get(terminal, 'room.storage.store.energy', 999999999) < (terminal.pos.roomName == Memory.levelroom ? 425000 : 250000));
        let sourceTerminals = _.filter(Game.federation.structures.terminal, terminal => terminal.store.energy > ENERGY_TRANSFER_AMOUNT + 10000 && _.get(terminal, 'room.storage.store.energy', 0) > 350000);
        let targetClusters = _.filter(Game.clusters, cluster => cluster.totalEnergy < 100000 && cluster.structures.terminal.length > 0);
        if(sourceTerminals.length > 0){
            if(targetClusters.length > 0){
                for(let destCluster of targetClusters){
                    let targetTerminal = _.first(Util.sort.resource(RESOURCE_ENERGY, destCluster.structures.terminal));
                    if(targetTerminal.getResource(RESOURCE_ENERGY) < 100000 && sourceTerminals.length > 0){
                        let closest = Util.closest(targetTerminal, sourceTerminals);
                        if(closest && closest.send(RESOURCE_ENERGY, ENERGY_TRANSFER_AMOUNT, targetTerminal.pos.roomName) == OK){
                            console.log('Transferred', ENERGY_TRANSFER_AMOUNT, 'energy from', closest.room.memory.cluster, closest.pos.roomName, 'to', destCluster.id);
                            closest.room.cluster.profileAdd('transfer', -ENERGY_TRANSFER_AMOUNT);
                            targetTerminal.room.cluster.profileAdd('transfer', ENERGY_TRANSFER_AMOUNT);
                            transferred[closest.id] = true;
                            _.pull(sourceTerminals, closest);
                        }
                    }
                }
            }else if(overfill.length > 0){
                for(let target of overfill){
                    let closest = Util.closest(target, sourceTerminals);
                    if(closest && closest.send(RESOURCE_ENERGY, ENERGY_TRANSFER_AMOUNT, target.pos.roomName) == OK){
                        console.log('Overfilled', ENERGY_TRANSFER_AMOUNT, 'energy from', closest.room.memory.cluster, closest.pos.roomName, 'to', target.room.memory.cluster);
                        closest.room.cluster.profileAdd('transfer', -ENERGY_TRANSFER_AMOUNT);
                        target.room.cluster.profileAdd('transfer', ENERGY_TRANSFER_AMOUNT);
                        transferred[closest.id] = true;
                        _.pull(sourceTerminals, closest);
                    }
                }
            }
        }
    }

    static emptyTerminals(){
        let terminals = _.filter(Game.federation.structures.terminal, terminal => terminal.room.matrix.underSiege && terminal.getResource(RESOURCE_ENERGY) > 5000 && terminal.getStored() > terminal.getResource(RESOURCE_ENERGY));
        if(terminals.length){
            let targets = _.filter(Game.federation.structures.terminal, terminal => !terminal.room.matrix.underSiege && terminal.getStored() < terminal.getCapacity() * 0.8);
            terminals.forEach(terminal => {
                let resources = _.pick(terminal.getResourceList(), (amount, type) => amount > 100 && type != RESOURCE_ENERGY);
                let sending = _.first(_.keys(resources));
                let target = Util.closest(terminal, targets);
                if(target && terminal.send(sending, resources[sending], target.pos.roomName) == OK){
                    console.log('Emptying terminal', terminal.pos.roomName, terminal.room.cluster.id, 'sending', sending, resources[sending], target.pos.roomName);
                }
            });
        }
    }

    static levelTerminals(){
        let transferred = {};
        let terminals = Game.federation.structures.terminal;
        let terminalCount = terminals.length;
        let ideal = 5000;
        let idealTotal = ideal * terminalCount;
        _.forEach(Game.federation.resources, (data, type)=>{
            if(type == RESOURCE_ENERGY || data.stored < ideal){
                return;
            }

            let needed = _.filter(terminals, terminal => terminal.getResource(type) < ideal - 100 && !terminal.hasTag('empty'));
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
            Controller.react(cluster, type, labs[ix], labs[0], labs[1], data.components);
        }
    }

    static react(cluster, type, targetLab, labA, labB, components){
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
        if(cluster.boost[targetLab.id]){
            console.log('attempting to manu with boost lab', targetLab);
            return false;
        }
        targetLab.runReaction(labA, labB);
    }

    static scanForNukes(cluster){
        var targets = false;
        var repair = false;
        for(var room of cluster.roles.core){
            var nukes = room.find(FIND_NUKES);
            if(nukes.length > 0){
                Game.note('nuke', 'NUKE DETECTED: '+room.name);
                if(!targets){
                    targets = {};
                    repair = {};
                }
                var structures = room.find(FIND_STRUCTURES);
                var ramparts = _.filter(structures, struct => struct.structureType == STRUCTURE_RAMPART || struct.structureType == STRUCTURE_WALL);
                targets[room.name] = _.map(nukes, nuke => {
                    var inRange = _.filter(ramparts, struct => struct.pos.getRangeTo(nuke) <= 3);
                    var epicenter = _.first(_.filter(inRange, rampart => rampart.pos.getRangeTo(nuke) == 0));
                    for(var rampart of inRange){
                        _.set(repair, rampart.id, _.get(repair, rampart.id, cluster.opts.repair) + 5500000);
                    }
                    if(epicenter){
                        _.set(repair, epicenter.id, _.get(repair, epicenter.id, cluster.opts.repair) + 5500000);
                    }
                    return {
                        landingTick: Game.time + nuke.timeToLand,
                        pos: nuke.pos,
                        ramparts: _.map(inRange, 'id'),
                        epicenter: _.get(epicenter, 'id', false)
                    };
                });
            }
        }
        cluster.update('nukes', targets);
        cluster.update('repair', repair);
    }

    static autobuyResources(){
        if(Game.market.credits < 500000 || Game.cpu.bucket < 7500){
            return;
        }
        Game.perfAdd();
        var terminals = Game.federation.structures.terminal;
        var requests = {};
        for(var terminal of terminals){
            for(var resource in autobuyPriceLimit){
                if(terminal.getResource(resource) < 1000 && terminal.getResource(RESOURCE_ENERGY) > 10000){
                    if(!requests[resource]){
                        requests[resource] = [];
                    }
                    requests[resource].push(terminal);
                }
            }
        }

        if(_.size(requests) > 0){
            let orders = Game.market.getAllOrders({ type: ORDER_SELL });
            let count = 0;
            for(let resource in requests){
                if(count < 10 && Game.market.credits > 500000){
                    let availableOrders = _.filter(orders, order => order.resourceType == resource
                                                                    && order.price < autobuyPriceLimit[resource]
                                                                    && order.amount >= 500);
                    for(let terminal of requests[resource]){
                        if(count < 10 && Game.market.credits > 500000 && terminal.getResource(RESOURCE_ENERGY) > 10000){
                            if(availableOrders.length > 0){
                                var order = _.first(_.sortBy(availableOrders, 'price'));
                                if(order && order.amount >= 500){
                                    let amount = Math.min(2000, order.amount);
                                    if(Game.market.deal(order.id, amount, terminal.pos.roomName) == OK){
                                        count++;
                                        order.amount -= amount;
                                        console.log('Autobuy', resource, 'for room', terminal.pos.roomName, amount);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        Game.perfAdd('autobuy');
    }
}

module.exports = Controller;