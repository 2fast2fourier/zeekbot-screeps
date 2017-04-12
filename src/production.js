"use strict";

var Util = require('./util');

var DEFICIT_START_MIN = 750;
var DEFICIT_END_MIN = 0;
var CAPACITY_END_MIN = 100;

class Production {
    constructor(){}

    process(cluster){
        if(Game.interval(500)){
            cluster.structures.lab.filter(lab => !lab.hasTag('production') && !lab.hasTag('boost'))
                                  .forEach(lab => lab.addTag('production'));
        }
        if(!Game.interval(25)){
            return;
        }
        var resources = cluster.getResources();
        var targetAmount = _.size(cluster.structures.terminal) * 5000;
        var resourceList = _.values(REACTIONS.X);//_.filter(, val => val != 'XUHO2');
        var quota = _.zipObject(resourceList, _.map(resourceList, type => targetAmount));
        quota.G = 5000;
        quota.UO = targetAmount;

        var reactions = {};
        _.forEach(quota, (amount, type) => {
            this.generateReactions(type, amount - resources[type].total, reactions, true, resources);
        });

        Memory.stats.reaction = _.sum(_.map(reactions, reaction => Math.max(0, reaction.deficit)));

        for(let type in cluster.reaction){
            let deficit = _.get(reactions, [type, 'deficit'], 0);
            let capacity = _.get(reactions, [type, 'capacity'], 0);
            if(deficit <= DEFICIT_END_MIN || capacity < CAPACITY_END_MIN){
                console.log('Ending reaction:', type, '-', deficit, 'of', capacity);
                delete cluster.reaction[type];
            }else{
                this.updateReaction(type, cluster.reaction[type], reactions[type]);
            }
        }


        var freeLabs = this.countFreeLabs(cluster);
        var runnableReactions = _.filter(reactions, (reaction, type) => reaction.capacity > DEFICIT_START_MIN && reaction.deficit > DEFICIT_START_MIN && !cluster.reaction[type]);
        var sortedReactions = _.sortBy(runnableReactions, (reaction) => -Math.min(reaction.deficit, reaction.capacity));

        if(freeLabs.length > 0){
            for(let reaction of sortedReactions){
                if(freeLabs.length > 0){
                    console.log('Starting reaction:', reaction.type, '-', reaction.deficit, 'of', reaction.capacity);
                    this.startReaction(cluster, reaction.type, reaction, freeLabs);
                    freeLabs = this.countFreeLabs(cluster);
                }
            }
        }
        this.updateLabTransfers(cluster);
    }

    countFreeLabs(cluster){
        return _.difference(_.keys(cluster.labs), _.map(cluster.reaction, 'lab'));
    }

    updateLabTransfers(cluster){
        _.forEach(cluster.labs, labSet => _.forEach(labSet, (labId, ix)=>{
            cluster.transfer[labId] = false;
        }));
        _.forEach(cluster.reaction, (reaction, type)=>{
            var labs = cluster.labs[reaction.lab];
            _.forEach(labs, (labId, ix)=>{
                if(ix < reaction.components.length){
                    cluster.transfer[labId] = reaction.components[ix];
                }else{
                    cluster.transfer[labId] = 'store-'+type;
                }
            });
        });
        _.forEach(cluster.boost, (boost, labId)=>{
            cluster.transfer[labId] = Game.boosts[boost];
        });
    }

    startReaction(cluster, type, reaction, freeLabs){
        reaction.lab = _.first(freeLabs);
        cluster.reaction[type] = reaction;
    }

    updateReaction(type, reaction, updated){
        reaction.deficit = updated.deficit;
        reaction.capacity = updated.capacity;
        reaction.current = updated.current;
    }

    generateReactions(type, deficit, output, topLevel, resources){
        if(type.length == 1 && (!topLevel || type != 'G')){
            return;
        }
        var components = this.findReaction(type);
        var inventory = _.map(components, component => resources[component].total);
        _.forEach(inventory, (amount, ix) =>  this.generateReactions(components[ix], deficit - amount, output, false, resources));

        if(output[type]){
            output[type].deficit += deficit;
        }else{
            output[type] = { type, components, deficit, capacity: _.min(inventory), current: resources[type].total };
        }
    }

    findReaction(type){
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