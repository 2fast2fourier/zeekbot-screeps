export default function linkTransfer(cluster, args, allocated) {
    var linkData = cluster.state.links;
    for(let roomName in linkData){
        if(roomName == 'sources' || roomName == 'storage'){
            continue;
        }
        let data = linkData[roomName];
        let targets: StructureLink[] = Game.getObjects(data.targets);
        for(let sourceId of data.sources){
            let sourceLink = Game.getObjectById(sourceId) as StructureLink;
            if(!sourceLink || sourceLink.energy < 50 || sourceLink.cooldown > 0){
                continue;
            }
            let target = _.find(targets, target => target && target.energy < target.energyCapacity - 100);
            if(target){
                sourceLink.transferEnergy(target, Math.min(sourceLink.energy, target.energyCapacity - target.energy));
            }
        }
    }
}