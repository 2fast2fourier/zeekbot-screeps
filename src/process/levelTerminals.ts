const Util = require('../util');

export default function levelTerminals(cluster, args, allocated) {
    let terminals = _.filter(Game.federation.structures.terminal, terminal => !terminal.hasTag('empty'));
    let resources = Game.federation.resources;
    let terminalCount = terminals.length;

    _.forEach(resources, (data, type)=>{
        if(type == RESOURCE_ENERGY || data.totals.terminal < 1000 * terminalCount){
            return;
        }
        let ideal = Math.floor(data.totals.terminal / terminalCount);

        let excess = _.filter(terminals, terminal => !allocated[terminal.id] && terminal.getResource(type!) >= ideal + 250 && terminal.getResource(RESOURCE_ENERGY) > 5000);
        let needed = _.filter(terminals, terminal => terminal.getResource(type!) <= ideal - 250);

        if(needed.length > 0 && excess.length > 0){
            let source: StructureTerminal = _.last(Util.sort.resource(type, excess));
            let destination: StructureTerminal = _.first(Util.sort.resource(type, needed));
            let sourceAmount = source.getResource(type!);
            var destinationAmount = destination.getResource(type!);
            var sending = Math.min(sourceAmount - ideal, ideal - destinationAmount);
            if(sending >= 100){
                console.log('Transferring', sending, type, 'from', source.pos.roomName, 'to', destination.pos.roomName);
                if(source.send(type!, sending, destination.pos.roomName) == OK){
                    allocated[source.id] = true;
                }
                return;
            }
        }
    });
}