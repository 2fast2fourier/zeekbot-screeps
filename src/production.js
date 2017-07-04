"use strict";

var Util = require('./util');

var DEFICIT_START_MIN = 1000;
var CAPACITY_END_MIN = 500;

class Production {
    static process(){
        if(!Game.interval(25)){
            return;
        }
        if(!Memory.state.reaction){
            Memory.state.reaction = {};
        }
        var resources = Game.federation.resources;
        var targetAmount = _.size(Game.federation.structures.terminal) * 5000 + 5000;
        var resourceList = _.values(REACTIONS.X);
        var quota = _.zipObject(resourceList, _.map(resourceList, type => targetAmount));
        quota.G = targetAmount;
        quota.OH = targetAmount;
        // quota.XUH2O = targetAmount * 2;
        quota.XKHO2 = targetAmount + 5000;
        // quota.XLHO2 = targetAmount * 2;
        // quota.XZHO2 = targetAmount * 2;
        // quota.XGHO2 = targetAmount * 2;

        var allocated = {};
        var reactions = {};
        _.forEach(quota, (amount, type) => {
            Production.generateReactions(type, amount - resources[type].total, reactions, true, resources);
        });

        Memory.stats.reaction = _.sum(_.map(reactions, reaction => Math.max(0, reaction.deficit)));
        Memory.stats.reactionTypes = _.pick(_.mapValues(reactions, 'deficit'), deficit => deficit >= DEFICIT_START_MIN);
        Memory.state.requests = {};

        for(let type in Memory.state.reaction){
            let deficit = _.get(reactions, [type, 'deficit'], 0);
            let capacity = _.get(reactions, [type, 'capacity'], 0);
            if(deficit <= 0 || capacity <= CAPACITY_END_MIN){
                console.log('Ending reaction:', type, '-', deficit, 'of', capacity);
                delete Memory.state.reaction[type];
            }else{
                let reaction = reactions[type];
                Production.updateReaction(type, Memory.state.reaction[type], reaction);
                for(let component of reaction.components){
                    allocated[component] = _.get(allocated, component, 0) + reaction.deficit;
                }
            }
        }

        var runnableReactions = _.filter(reactions, (reaction, type) => reaction.capacity >= DEFICIT_START_MIN
                                                                     && reaction.deficit >= DEFICIT_START_MIN
                                                                     && Production.checkAllocations(reaction, allocated, resources)
                                                                     && !Memory.state.reaction[type]);
        if(runnableReactions.length > 0){

            var freeRooms = Production.getOpenRooms();
            if(freeRooms.length > 0){
                var sortedReactions = _.sortBy(runnableReactions, (reaction) => -Math.min(reaction.deficit, reaction.capacity));
                for(let reaction of sortedReactions){
                    if(freeRooms.length > 0){
                        var targetRoom = _.first(freeRooms);
                        console.log('Starting reaction:', reaction.type, 'x', Math.min(reaction.deficit, reaction.capacity), 'in', targetRoom);
                        _.pull(freeRooms, targetRoom);
                        Production.startReaction(reaction.type, reaction, targetRoom);
                        for(let component of reaction.components){
                            allocated[component] = _.get(allocated, component, 0) + reaction.deficit;
                        }
                    }
                }
            }
        }

        _.forEach(Game.clusters, Production.updateLabTransfers);
    }

    static checkAllocations(reaction, allocated, resources){
        return _.all(reaction.components, comp => resources[comp].total - _.get(allocated, comp, 0) > DEFICIT_START_MIN);
    }

    static getOpenRooms(){
        var freeRooms = _.difference(_.flatten(_.compact(_.map(Game.clusters, cluster => _.keys(cluster.state.labs)))), _.map(Memory.state.reaction, 'room'));
        return _.sortBy(freeRooms, room => -_.size(Game.clusterForRoom(room).state.labs[room]));
    }

    static updateLabTransfers(cluster){
        cluster.state.transfer = {};
        _.forEach(cluster.structures.lab, lab => {
            cluster.state.transfer[lab.id] = false;
        });
        var reactions = _.pick(Memory.state.reaction, reaction => cluster.state.labs[reaction.room] != undefined);
        _.forEach(reactions, (reaction, type)=>{
            var labs = cluster.state.labs[reaction.room];
            _.forEach(labs, (labId, ix)=>{
                if(ix < reaction.components.length){
                    let component = reaction.components[ix];
                    if(!Memory.state.requests[component]){
                        Memory.state.requests[component] = [];
                    }
                    cluster.state.transfer[labId] = component;
                    Memory.state.requests[component].push(reaction.room);
                }else{
                    cluster.state.transfer[labId] = 'store-'+type;
                }
            });
        });
        _.forEach(cluster.boost, (boost, labId)=>{
            if(Game.getObjectById(labId)){
                cluster.state.transfer[labId] = Game.boosts[boost];
            }else{
                console.log('Deleting boost ' + boost + ' for lab', labId, cluster.id);
                Game.notify('Deleting boost ' + boost + ' for lab ' + labId + ' ' + cluster.id);
                delete cluster.boost[labId];
            }
        });
    }

    static startReaction(type, reaction, room){
        reaction.room = room;
        Memory.state.reaction[type] = reaction;
    }

    static updateReaction(type, reaction, updated){
        reaction.deficit = updated.deficit;
        reaction.capacity = updated.capacity;
        reaction.current = updated.current;
    }
    static generateReactions(type, deficit, output, topLevel, resources){
        if(type.length == 1 && (!topLevel || type != 'G')){
            return;
        }
        var components = Production.findReaction(type);
        var inventory = _.map(components, component => resources[component].total);
        _.forEach(inventory, (amount, ix) =>  Production.generateReactions(components[ix], (deficit - amount) + 500, output, false, resources));

        if(deficit > 0){
            if(output[type]){
                output[type].deficit += deficit;
            }else{
                output[type] = { type, components, deficit, capacity: _.min(inventory), current: resources[type].total };
            }
        }
    }

    static findReaction(type){
        var components = [];
        var comp1 = _.findKey(REACTIONS, (reactionData, firstComp) => {
            var comp2 = _.findKey(reactionData, (result, secondComp) => result === type);
            if(comp2){
                components.push(comp2);
                return true;
            }
            return false;
        });
        if(comp1){
            components.push(comp1);
            return components;
        }
        console.log('invalid reaction', type);
        return false;
    }

}

module.exports = Production;