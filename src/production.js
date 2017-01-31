"use strict";

var Util = require('./util');

class Production {
    constructor(catalog){
        this.catalog = catalog;
    }

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

        _.forEach(Memory.reaction, (data, type)=>{
            if(!reactions[type]){
                var labs = Memory.production.labs[data.lab];
                _.forEach(data.assignments, (labNum) => {
                    Memory.transfer.lab[labs[labNum]] = false;
                });
                delete Memory.reaction[type];
            }
        });

        var assignments = this.findAllAssignments();
        var freeLabs = this.countFreeLabs(assignments);
        _.forEach(reactions, (reaction, type) => {
            if(Memory.reaction[type]){
                this.updateReaction(type, Memory.reaction[type], reaction);
            }else if(_.sum(freeLabs) >= 3){
                var reservation = this.allocateLabs(type, reaction, freeLabs);
                if(reservation && this.startReaction(type, reaction, reservation, freeLabs, assignments)){
                    freeLabs = this.countFreeLabs(assignments);
                }
            }
        });
        this.updateLabTransfers(this.findAllAssignments());
    }

    updateLabTransfers(assignments){
        _.forEach(Memory.production.labs, labSet => _.forEach(labSet, (labId, ix)=>{
            Memory.transfer.lab[labId] = false;
        }));
        _.forEach(assignments, (assign, labNum)=>{
            var labs = Memory.production.labs[labNum];
            _.forEach(assign, (labNum, type)=>{
                Memory.transfer.lab[labs[labNum]] = type;
            });
        });
    }

    countFreeLabs(assignments){
        return _.map(Memory.production.labs, (labs, ix) => labs.length - _.size(_.get(assignments, ix, [])));
    }

    allocateLabs(type, reaction, freeLabs){
        var labSet = this.findFreeLab(reaction.size, freeLabs);
        if(labSet >= 0){
            var chains = {};
            chains[type] = labSet;
            return chains;
        }
        var chains = this.allocateLabs(_.first(_.keys(reaction.children)), _.first(_.values(reaction.children)), freeLabs);
        labSet = this.findFreeLab(3, freeLabs, _.values(chains));
        if(chains && labSet >= 0){
            chains[type] = labSet;
            return chains;
        }

        return false;
    }

    findFreeLab(count, freeLabs, exclude){
        var target = -1;
        var targetDiff = Infinity;
        _.forEach(freeLabs, (labs, ix)=>{
            if(exclude && _.includes(exclude, ix)){
                return;
            }
            if(labs >= count && labs - count < targetDiff){
                target = ix;
                targetDiff = labs - count;
            }
        });
        return target;
    }

    assignLabs(reservations, type, reaction, assignments, labNum){
        if(_.has(reservations, type)){
            labNum = reservations[type];
        }
        var assignedChildren = _.every(reaction.children, (child, childType) => this.assignLabs(reservations, childType, child, assignments, labNum));
        if(assignedChildren){
            var localAssignments = {};
            var assignedComponents = _.every(reaction.components, component => {
                if(!_.has(assignments, [labNum, component])){
                    var targetLab = this.findNextLab(assignments, labNum);
                    if(targetLab < 0){
                        return false;
                    }
                    localAssignments[component] = targetLab;
                    _.set(assignments, [labNum, component], targetLab);
                }else{
                    localAssignments[component] = _.get(assignments, [labNum, component]);
                }
                return true;
            });
            if(assignedComponents){
                if(!_.has(assignments, [labNum, type])){
                    var targetLab = this.findNextLab(assignments, labNum);
                    if(targetLab < 0){
                        return false;
                    }
                    localAssignments[type] = targetLab;
                    _.set(assignments, [labNum, type], targetLab);
                }else{
                    localAssignments[type] = _.get(assignments, [labNum, type]);
                }
                reaction.lab = labNum;
                reaction.assignments = localAssignments;
                return true;
            }
        }
        console.log('failed to assign', type);
        return false;
    }

    findAllAssignments(){
        var assignments = {};
        _.forEach(Memory.reaction, data => this.collectAssignments(assignments, data));
        return assignments;
    }

    collectAssignments(assignments, reaction){
        if(!assignments[reaction.lab]){
            assignments[reaction.lab] = {};
        }
        _.forEach(reaction.assignments, (lab, type)=>{
            assignments[reaction.lab][type] = lab;
        });
        _.forEach(reaction.children, child => this.collectAssignments(assignments, child));
    }

    findNextLab(assignments, labNum){
        var assignedLabs = _.values(assignments[labNum]);
        var labs = Memory.production.labs[labNum];
        return _.findIndex(labs, (labId, ix)=> !_.includes(assignedLabs, ix));
    }

    startReaction(type, reaction, reservations, freeLabs, assignments){
        if(this.assignLabs(reservations, type, reaction, assignments, reservations[type])){
            Memory.reaction[type] = reaction;
        }
        return true;
    }

    updateReaction(type, reaction, updated){
        reaction.deficit = updated.deficit;
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