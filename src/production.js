"use strict";

var Util = require('./util');

var CAPACITY_END_MIN = 100;
var DEFICIT_END_MIN = 0;
var DEFICIT_START_MIN = 1000;

class Production {
    constructor(catalog){
        this.catalog = catalog;
    }

    process(){
        if(!Util.interval(25)){
            return;
        }
        var resources = _.values(REACTIONS.X);
        resources.push('G');

        var reactions = {};
        var targetAmount = _.size(this.catalog.buildings.terminal) * 5000;
        _.forEach(resources, (type) => {
            this.generateReactions(type, targetAmount - this.catalog.resources[type].total, reactions, true);
        });
        // _.forEach(reactions, (data, type) => console.log(type, data.capacity, data.current, data.deficit, data.current / targetAmount));


        _.forEach(Memory.reaction, (data, type)=>{
            var deficit = _.get(reactions, [type, 'deficit'], 0);
            var capacity = _.get(reactions, [type, 'capacity'], 0);
            if(deficit <= DEFICIT_END_MIN || capacity <= CAPACITY_END_MIN){
                console.log('Ending reaction:', type, '-', deficit, 'of', capacity);
                delete Memory.reaction[type];
            }else{
                this.updateReaction(type, data, reactions[type]);
            }
        });

        var freeLabs = this.countFreeLabs();
        var runnableReactions = _.filter(reactions, (reaction, type) => reaction.capacity > DEFICIT_START_MIN && reaction.deficit > DEFICIT_START_MIN && !Memory.reaction[type]);
        var sortedReactions = _.sortBy(runnableReactions, (reaction) => -Math.min(reaction.deficit, reaction.capacity));

        if(freeLabs.length > 0){
            _.forEach(sortedReactions, reaction => {
                var type = reaction.type;
                if(freeLabs.length > 0){
                    console.log('Starting reaction:', type, '-', reaction.deficit, 'of', reaction.capacity);
                    this.startReaction(type, reaction, freeLabs);
                    freeLabs = this.countFreeLabs();
                }
            });
        }
        this.updateLabTransfers();
    }

    countFreeLabs(){
        return _.difference(_.keys(Memory.production.labs), _.map(Memory.reaction, 'lab'));
    }

    updateLabTransfers(){
        _.forEach(Memory.production.labs, labSet => _.forEach(labSet, (labId, ix)=>{
            Memory.transfer.lab[labId] = false;
        }));
        _.forEach(Memory.reaction, (reaction, type)=>{
            var labs = Memory.production.labs[reaction.lab];
            _.forEach(labs, (labId, ix)=>{
                if(ix < reaction.components.length){
                    Memory.transfer.lab[labId] = reaction.components[ix];
                }else{
                    Memory.transfer.lab[labId] = 'store-'+type;
                }
            });
        });
    }

    startReaction(type, reaction, freeLabs){
        reaction.lab = _.first(freeLabs);
        Memory.reaction[type] = reaction;
    }

    updateReaction(type, reaction, updated){
        reaction.deficit = updated.deficit;
        reaction.capacity = updated.capacity;
        reaction.current = updated.current;
    }

    generateReactions(type, deficit, output, topLevel){
        if(type.length == 1 && (!topLevel || type != 'G')){
            return;
        }
        var components = this.findReaction(type);
        var inventory = _.map(components, component => this.catalog.resources[component].total);
        _.forEach(inventory, (amount, ix) =>  this.generateReactions(components[ix], deficit - amount, output, false));

        if(output[type]){
            output[type].deficit += deficit;
        }else{
            output[type] = { type, components, deficit, capacity: _.min(inventory), current: this.catalog.resources[type].total };
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