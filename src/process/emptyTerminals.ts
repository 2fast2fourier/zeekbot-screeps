const Util = require('../util');

export default function emptyTerminals(cluster, args, allocated) {
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