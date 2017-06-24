"use strict";

const Util = require('./util');
const roomRegex = /([WE])(\d+)([NS])(\d+)/;
const ENERGY_TRANSFER_AMOUNT = 20000;

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
        if(_.size(Memory.observe) > 0){
            var observers = _.filter(Game.federation.structures.observer, struct => !_.includes(allocated, struct.id));
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
            if(tower.energy >= 10){
                let data = Game.matrix.rooms[tower.pos.roomName];
                let hostile = data.target;
                if(hostile){
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
        let overfill = _.filter(Game.federation.structures.terminal, terminal => terminal.store.energy < 100000 && _.get(terminal, 'room.storage.store.energy', 999999999) < 250000);
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
        let terminals = _.filter(Game.federation.structures.terminal, terminal => terminal.hasTag('empty') && terminal.getResource(RESOURCE_ENERGY) > 5000 && terminal.getStored() > terminal.getResource(RESOURCE_ENERGY));
        if(terminals.length){
            let targets = _.filter(Game.federation.structures.terminal, terminal => !terminal.hasTag('empty') && terminal.getStored() < terminal.getCapacity() * 0.8);
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
}

module.exports = Controller;