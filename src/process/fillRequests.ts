export default function fillRequests(cluster, args, allocated) {
    if(_.size(Memory.state.requests) > 0){
        var resources = Game.federation.resources;
        for(let type in Memory.state.requests){
            if(resources[type].totals.terminal >= 100 && _.some(resources[type].terminal, terminal => terminal.getResource(type) >= 100)){
                let requests: string[] = Memory.state.requests[type];
                let rooms = _.compact(_.map(requests, roomName => Game.rooms[roomName]));
                let terminals = _.filter((<StructureTerminal[]>_.map(rooms, 'terminal')), term => term && term.getResource(type) < 3000);
                let target = _.min(terminals, terminal => terminal.getResource(type));
                if(_.isObject(target)){
                    let source = _.max(_.filter(resources[type].terminal, terminal => !_.includes(requests, terminal.pos.roomName)
                                                                                   && !allocated[terminal.id]
                                                                                   && terminal.getResource(type) >= 100
                                                                                   && terminal.id != target.id),
                                       terminal => terminal.getResource(type));
                    if(_.isObject(source)){
                        let amount = Math.min(5000 - target.getResource(type), source.getResource(type));
                        source.send(type, amount, target.pos.roomName);
                        allocated[source.id] = true;
                        console.log('Requested', type, 'x', amount, 'sent from', source.pos.roomName, ' -> ', target.pos.roomName);
                    }
                }
            }
        }
    }
}