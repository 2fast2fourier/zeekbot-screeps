const Util = require('../util');

export default function terminalEnergy(cluster, args, allocated) {
    let transferAmount = 20000;
    let average = Game.federation.resources.energy.totals.storage / Game.federation.structures.storage.length;
    Memory.stats.energyStores = average;
    let targets = _.filter(Game.federation.structures.terminal, terminal => _.get(terminal, 'room.storage.store.energy', 999999999)
                                                                            < (terminal.pos.roomName == Memory.state.levelroom ? 450000 : average - (transferAmount * 2))
                                                                                && terminal.store.energy < 100000);
    targets = _.sortBy(targets, target => _.get(target, 'room.storage.store.energy', 999999999));
    let sources = _.filter(Game.federation.structures.terminal, terminal => !allocated[terminal.id]
                                                                            && terminal.store.energy > transferAmount * 2
                                                                            && _.get(terminal, 'room.storage.store.energy', 0) > (average + transferAmount * 2)
                                                                            && terminal.pos.roomName != Memory.state.levelroom);

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