export default function walls(cluster, args, allocation) {
    let wallStructs = cluster.getAllStructuresForRole('core', [STRUCTURE_WALL, STRUCTURE_RAMPART]);
    let hits = _.map(wallStructs, 'hits');
    cluster.work.walls = {
        data: _.map(wallStructs, 'id'),
        avg: _.sum(hits) / Math.max(1, wallStructs.length),
        min: _.min(hits),
        max: _.max(hits),
        update: Game.time + 1000
    }
}