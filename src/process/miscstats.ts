export default function MiscStats(cluster, args, allocated) {
    Memory.stats.harvest = _.reduce(Game.clusters, (result, cluster) => {
        var minerals = _.filter(cluster.findAll(FIND_MINERALS) as Mineral[], mineral => mineral.hasExtractor());
        for(let mineral of minerals){
            let current = result[mineral.mineralType] || 0;
            if(mineral.mineralAmount > 0){
                result[mineral.mineralType] = Math.max(0, current) + mineral.mineralAmount;
            }else if(mineral.ticksToRegeneration > 0 && current <= 0 && (-mineral.ticksToRegeneration > current || current == 0)){
                result[mineral.mineralType] = -mineral.ticksToRegeneration;
            }
        }
        return result;
    }, {})
}