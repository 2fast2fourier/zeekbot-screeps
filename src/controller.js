"use strict";

const Util = require('./util');
const roomRegex = /([WE])(\d+)([NS])(\d+)/;

const autobuyPriceLimit = {
    H: 0.31,
    O: 0.26,
    XKHO2: 1.51,
    XZHO2: 1.51,
    XGHO2: 1.51
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
        if(Game.intervalOffset(20, 3)){
            var buildFlags = Flag.getByPrefix('Build');
            _.forEach(buildFlags, flag => Controller.buildFlag(flag));

            for(let term of Game.federation.structures.terminal){
                if(term.cooldown > 0){
                    allocated[term.id] = true;
                }
            }

            Controller.emptyTerminals(allocated);
            Controller.fillRequests(allocated);
            Controller.levelTerminals(allocated);
            Controller.terminalEnergy(allocated);
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
                        var message = 'Warning: Player creeps detected: ' + room.name + ' - ' + _.get(matrix.creeps, 'player[0].owner.username', 'Unknown');
                        Game.note('portalWarn'+room.name, message);
                        for(let clusterName in Game.clusters){
                            var cluster = Game.clusters[clusterName];
                            if(cluster.opts.portals && _.includes(cluster.opts.portals, room.name)){
                                cluster.state.defcon = Game.time + 1000;
                            }
                        }
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
            Controller.autobuyResources(allocated);
        }

        if(Game.intervalOffset(10, 1)){
            _.forEach(Memory.state.reaction, (data, type) => Controller.runReaction(type, data));
        }
    }

    static control(cluster, allocated){

        var scanner = Game.getObjectById(cluster.scanner);
        if(scanner){
            allocated[scanner.id] = true;
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
            let hardTarget = false;
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
                        hardTarget = true;
                    }
                }
                if(data.damaged.length > 0){
                    action = tower.heal(_.first(data.damaged)) == OK;
                }
                var energySaver = cluster.totalEnergy < 250000 && (data.armed.length == 0 && data.total.work == 0);
                if(!action && hostile && (tower.energy > 500 || hardTarget || hostile.hits < hostile.maxHits * 0.5) && !energySaver){
                    action = tower.attack(hostile) == OK;
                }
            }
        });
        if(Game.intervalOffset(500, 6)){
            Controller.scanForNukes(cluster);
        }

        if(Game.intervalOffset(1000, 16) || !cluster.state.links){
            let linkData = {
                sources: {},
                storage: []
            };
            for(let link of cluster.structures.link){
                let roomData = linkData[link.pos.roomName];
                if(!roomData){
                    roomData = {
                        sources: [],
                        targets: []
                    };
                    linkData[link.pos.roomName] = roomData;
                }
                let sources = link.pos.findInRange(FIND_SOURCES, 2);
                if(sources.length > 0){
                    roomData.sources.push(link.id);
                    linkData.sources[link.id] = true;
                }else{
                    roomData.targets.push(link);
                    if(link.pos.getRangeTo(link.room.storage) < 4){
                        linkData.storage.push(link.id);
                    }
                }
            }
            for(let room in linkData){
                let data = linkData[room];
                data.targets = _.map(_.sortBy(data.targets, target => -target.pos.getRangeTo(target.room.storage) || Infinity), 'id');
            }
            cluster.state.links = linkData;
        }

        if(Game.intervalOffset(10, 3)){
            Controller.linkTransfer(cluster);
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
        var linkData = cluster.state.links;
        for(let roomName in linkData){
            if(roomName == 'sources' || roomName == 'storage'){
                continue;
            }
            let data = linkData[roomName];
            let targets = Game.getObjects(data.targets);
            for(let sourceId of data.sources){
                let sourceLink = Game.getObjectById(sourceId);
                if(!sourceLink || sourceLink.energy < 50 || sourceLink.cooldown > 0){
                    continue;
                }
                let target = _.find(targets, target => target && target.energy < target.energyCapacity - 100);
                if(target){
                    sourceLink.transferEnergy(target, Math.min(sourceLink.energy, target.energyCapacity - target.energy));
                }
            }
        }
    }

    //// Terminals ////
    static fillRequests(allocated){
        if(_.size(Memory.state.requests) > 0){
            var resources = Game.federation.resources;
            for(let type in Memory.state.requests){
                if(resources[type].totals.terminal >= 100 && _.some(resources[type].terminal, terminal => terminal.getResource(type) >= 100)){
                    let requests = Memory.state.requests[type];
                    let rooms = _.compact(_.map(requests, roomName => Game.rooms[roomName]));
                    let terminals = _.pick(_.zipObject(rooms, _.map(rooms, 'terminal')), term => term && term.getResource(type) < 3000);
                    let target = _.min(terminals, terminal => terminal.getResource(type));
                    if(_.isObject(target)){
                        let source = _.max(_.filter(resources[type].terminal, terminal => !_.includes(requests, terminal.pos.roomName)
                                                                                       && !allocated[terminal.id]
                                                                                       && terminal.getResource(type) >= 100
                                                                                       && terminal.id != target.id),
                                           terminal => terminal.getResource(type));
                        if(_.isObject(source)){
                            let amount = Math.min(5000 - target.getResource(type), source.getResource(type));
                            source.send(type, amount, target.pos.roomName);
                            allocated[source.id] = true;
                            console.log('Requested', type, 'x', amount, 'sent from', source.pos.roomName, ' -> ', target.pos.roomName);
                        }
                    }
                }
            }
        }
    }

    static terminalEnergy(allocated){
        let transferAmount = 20000;
        let average = Game.federation.resources.energy.totals.storage / Game.federation.structures.storage.length;
        Memory.stats.energyStores = average;
        let targets = _.filter(Game.federation.structures.terminal, terminal => _.get(terminal, 'room.storage.store.energy', 999999999) < average - (transferAmount * 2) && terminal.store.energy < 100000);
        targets = _.sortBy(targets, target => _.get(target, 'room.storage.store.energy', 999999999));
        let sources = _.filter(Game.federation.structures.terminal, terminal => !allocated[terminal.id] && terminal.store.energy > transferAmount * 2 && _.get(terminal, 'room.storage.store.energy', 0) > (average + transferAmount * 2));

        if(targets.length > 0 && sources.length > 0){
            for(let target of targets){
                var source = Util.closest(target, sources);
                if(source && source.send(RESOURCE_ENERGY, transferAmount, target.pos.roomName) == OK){
                    console.log('Transferred', transferAmount, 'energy from', source.room.cluster.id, 'to', target.room.cluster.id);
                    allocated[source.id] = true;
                    _.pull(sources, source);
                }
            }
        }
    }

    static emptyTerminals(allocated){
        let terminals = _.filter(Game.federation.structures.terminal, terminal => terminal.hasTag('empty') && terminal.getResource(RESOURCE_ENERGY) > 5000 && terminal.getStored() > terminal.getResource(RESOURCE_ENERGY));
        if(terminals.length){
            let targets = _.filter(Game.federation.structures.terminal, terminal => !terminal.hasTag('empty') && terminal.getStored() < terminal.getCapacity() * 0.8);
            terminals.forEach(terminal => {
                let resources = _.pick(terminal.getResourceList(), (amount, type) => amount > 100 && type != RESOURCE_ENERGY);
                let sending = _.first(_.keys(resources));
                let target = Util.closest(terminal, targets);
                if(target && terminal.send(sending, Math.min(resources[sending], target.getAvailableCapacity() * 0.75), target.pos.roomName) == OK){
                    allocated[terminal.id] = true;
                    console.log('Emptying terminal', terminal.pos.roomName, terminal.room.cluster.id, 'sending', sending, Math.min(resources[sending], target.getAvailableCapacity() * 0.75), target.pos.roomName);
                }
            });
        }
    }

    static levelTerminals(allocated){
        let terminals = _.filter(Game.federation.structures.terminal, terminal => !terminal.hasTag('empty'));
        let resources = Game.federation.resources;
        let terminalCount = terminals.length;

        _.forEach(resources, (data, type)=>{
            if(type == RESOURCE_ENERGY || data.totals.terminal < 1000 * terminalCount){
                return;
            }
            let ideal = Math.floor(data.totals.terminal / terminalCount);

            let excess = _.filter(terminals, terminal => !allocated[terminal.id] && terminal.getResource(type) >= ideal + 250 && terminal.getResource(RESOURCE_ENERGY) > 5000);
            let needed = _.filter(terminals, terminal => terminal.getResource(type) <= ideal - 250);

            if(needed.length > 0 && excess.length > 0){
                let source = _.last(Util.sort.resource(type, excess));
                let destination = _.first(Util.sort.resource(type, needed));
                let sourceAmount = source.getResource(type);
                var destinationAmount = destination.getResource(type);
                var sending = Math.min(sourceAmount - ideal, ideal - destinationAmount);
                if(sending >= 100){
                    console.log('Transferring', sending, type, 'from', source.pos.roomName, 'to', destination.pos.roomName);
                    if(source.send(type, sending, destination.pos.roomName) == OK){
                        allocated[source.id] = true;
                    }
                    return;
                }
            }
        });
    }

    //// Reactions ////

    static runReaction(type, data){
        var cluster = Game.clusterForRoom(data.room);

        if(!cluster || !cluster.state.labs[data.room]){
            Game.note('runReactionInvalid', 'invalid reaction/lab! ' + type + ' ' + data.room);
            return;
        }
        var labs = Game.getObjects(cluster.state.labs[data.room]);
        for(var ix=2; ix<labs.length; ix++){
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
        if(Memory.clusters[cluster.id].nukes){
            delete Memory.clusters[cluster.id].nukes;
        }
        var targets = false;
        var repair = false;
        for(var room of cluster.roles.core){
            var nukes = room.find(FIND_NUKES);
            if(nukes.length > 0){
                if(!cluster.state.nukes){
                    Game.note('nuke', 'NUKE DETECTED: '+room.name);
                }
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
        cluster.state.nukes = targets;
        cluster.state.repair = _.pick(repair, (amount, id) => Game.getObjectById(id).hits < amount);
        cluster.update('repair', repair);
    }

    static autobuyResources(){
        if(Game.market.credits < 500000 || Game.cpu.bucket < 7500){
            return;
        }
        var terminals = Game.federation.structures.terminal;
        var requests = {};
        for(var terminal of terminals){
            for(var resource in autobuyPriceLimit){
                if(terminal.getResource(resource) < 1000 && terminal.getResource(RESOURCE_ENERGY) > 10000 && !terminal.hasTag('empty')){
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
                                                                    && order.price <= autobuyPriceLimit[resource]
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
    }
}

module.exports = Controller;