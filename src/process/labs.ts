export default function labs(cluster: Cluster, args, allocated) {
    let roomLabs = _.mapValues(_.groupBy(cluster.structures.lab, 'pos.roomName'), (labs, roomName) => _.filter(labs, lab => !cluster.boost[lab.id]));
    roomLabs = _.pick(roomLabs, labs => _.get(_.first(labs), 'room.terminal', false));
    let labs = _.pick(_.mapValues(roomLabs, (labs, roomName) => _.map(_.sortBy(labs, lab => (lab.inRangeToAll(labs, 2) ? 'a' : 'z') + lab.id), 'id')), labs => labs.length > 2);
    cluster.update('labs', _.values(labs));
    cluster.state.labs = labs;
}