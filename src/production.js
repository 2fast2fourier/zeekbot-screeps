"use strict";

var Util = require('./util');

class Production {
    constructor(catalog){
        this.catalog = catalog;
    }

//production{
//     labs: [[labs]],
//     quota: {resource: count}
// }
// react{
//     type: {
//          lab: labNum,
//          deficit,
//          components,
//      }
// }
    process(){
        if(!Util.interval(25)){
            return;
        }
        var needs = _.pick(Memory.production.quota, (amount, type) => amount > this.catalog.getTotalStored(type));
        var reactions = {};
        _.forEach(needs, (amount, type) => {
            var temp = {};
            this.generateReactions(type, amount - this.catalog.getTotalStored(type), temp, true);
            reactions[type] = temp[type];
        });
        // var components = _.uniq(_.flatten(_.map(reactions, 'allComponents')));
        // var topReactions = _.pick(reactions, (data, type)=>!_.includes(components, type));
        // _.forEach(topReactions, (reaction, type)=>console.log(type, reaction.size));
        _.forEach(Memory.react, (data, type)=>{
            if(!reactions[type]){
                var labs = Memory.production.labs[data.lab];
                _.forEach(labs, (lab) => {
                    Memory.transfer.lab[lab] = false;
                });
                delete Memory.react[type];
            }
        });
        _.forEach(reactions, (reaction, type) => {
            if(Memory.react[type]){
                Memory.react[type].deficit = reaction.deficit;
            }else if(_.size(Memory.react) < _.size(Memory.production.labs)){
                var labNum = this.findFreeLab(reaction.size);
                var fullReaction = true;
                if(labNum < 0){
                    labNum = this.findFreeLab(3);
                    fullReaction = false;
                }
                if(labNum < 0){
                    return;
                }
                var labs = Memory.production.labs[labNum];
                var assignments = {};
                _.forEach(labs, (labId, ix) => Memory.transfer.lab[labs[ix]] = false);
                Memory.transfer.lab[labs[0]] = type;
                assignments[type] = 0;
                if(fullReaction){
                    _.forEach(reaction.allComponents, (component, ix) => {
                        Memory.transfer.lab[labs[ix+1]] = component;
                        assignments[component] = ix+1;
                    });
                }else{
                    _.forEach(reaction.components, (component, ix) => {
                        Memory.transfer.lab[labs[ix+1]] = component;
                        assignments[component] = ix+1;
                    });
                }
                Memory.react[type] = {
                    lab: labNum,
                    deficit: reaction.deficit,
                    components: reaction.components,
                    children: reaction.children,
                    size: reaction.size,
                    allComponents: reaction.allComponents,
                    full: fullReaction,
                    assignments
                };
            }
        });
    }

    findFreeLab(count){
        return _.findIndex(Memory.production.labs, (labList, ix) => labList.length >= count && !_.any(Memory.react, (data) => data.lab == ix));
    }

    generateReactions(type, deficit, output, topLevel){
        if(type.length == 1 && (!topLevel || type != 'G')){
            return;
        }
        var components = this.findReaction(type);
        var inventory = _.map(components, component => this.catalog.getTotalStored(component) + this.catalog.getTotalLabResources(component));
        _.forEach(inventory, (amount, ix) => this.generateReactions(components[ix], deficit - amount + Memory.settings.productionOverhead, output, false));

        if(output[type]){
            output[type].deficit += deficit;
        }else{
            output[type] = { type, components, deficit };
        }
        var children = _.compact(_.map(components, comp => output[comp]));
        output[type].children = _.zipObject(_.map(children, 'type'), children);
        output[type].allComponents = _.union(components, _.flatten(_.map(output[type].children, 'allComponents')));
        output[type].size = output[type].allComponents.length + 1;
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