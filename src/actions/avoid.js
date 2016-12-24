"use strict";

var BaseAction = require('./base');

class AvoidAction extends BaseAction {
    constructor(catalog){
        super(catalog, 'avoid');
    }
}


module.exports = AvoidAction;