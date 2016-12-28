"use strict";

class Production {
    constructor(catalog){
        this.catalog = catalog;
    }

//production{
//     labs: [[3 labs]],
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
        if(Game.time < (Memory.productionTime || 0)){
            return;
        }
        Memory.productionTime = Game.time + 25;
        var needs = _.pick(Memory.production.quota, (amount, type) => amount > this.catalog.getTotalStored(type));
        var reactions = {};
        _.forEach(needs, (amount, type) => {
            this.generateReactions(type, amount - this.catalog.getTotalStored(type), reactions);
        });
        _.forEach(Memory.react, (data, type)=>{
            if(!reactions[type]){
                console.log('ending reaction', type);
                var labs = Memory.production.labs[data.lab];
                _.forEach(labs, (lab) => Memory.transfer.lab[lab] = false);
                delete Memory.react[type];
            }
        });
        _.forEach(reactions, (reaction, type) => {
            if(Memory.react[type]){
                Memory.react[type].deficit = reaction.deficit;
            }else if(_.size(Memory.react) < _.size(Memory.production.labs)){
                var labNum = this.findFreeLab();
                if(labNum < 0){
                    console.log('lab react mismatch!');
                    return;
                }
                Memory.react[type] = {
                    lab: labNum,
                    deficit: reaction.deficit,
                    components: reaction.components
                };
                var labs = Memory.production.labs[labNum];
                _.forEach(reaction.components, (component, ix) => Memory.transfer.lab[labs[ix]] = component);
                Memory.transfer.lab[labs[2]] = 'store';
            }
        });
    }

    findFreeLab(){
        return _.findIndex(Memory.production.labs, (labList, ix) => !_.any(Memory.react, (data) => data.lab == ix));
    }

    generateReactions(type, deficit, output){
        if(type.length == 1){
            console.log('missing base component', type, deficit);
            return;
        }
        var components = this.findReaction(type);
        var inventory = _.map(components, component => this.catalog.getTotalStored(component) + this.catalog.getTotalLabResources(component));
        var canReact = _.every(inventory, (amount, ix) => {
            if(deficit - amount > 0){
                // console.log(type, 'needs resource', components[ix], need);
                //generate child reactions
                this.generateReactions(components[ix], need, output);
            }
            return amount > 0;
        });

        if(canReact){
            // console.log('have everything for', type);
            if(output[type]){
                output[type].deficit += deficit;
            }else{
                output[type] = { components, deficit };
            }
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