
const Util = require('../util');

class Movement {

    static getWaypoint(squadId, wave, config){
        if(wave.waypoint === false){
            return;
        }
        var data = config.waypoints[wave.waypoint];
        if(data){
            return RoomPosition.fromStr(data.pos);
        }
    }

    static getPosList(squadId, wave, config, type){
        var list = wave.pos[type];
        if(list){
            return _.map(list, pos => RoomPosition.fromStr(pos));
        }else if(config.pos[type]){
            return _.map(config.pos[type], pos => RoomPosition.fromStr(pos));
        }
    }

    static process(squadId, config, wave, creeps){
        if(creeps && creeps.length > 0){
            if(config.movement == 'pairs'){
                for(let healId in wave.pairs){
                    if(!Game.getObjectById(healId)){
                        delete wave.pairs[healId];
                    }
                }
                for(let creep of creeps){
                    if(creep.memory.squadRole == 'heal'){
                        if(!wave.pairs[creep.id] || !Game.getObjectById(wave.pairs[creep.id])){
                            var target = _.first(_.sortBy(creeps, crp => _.size(_.filter(_.values(wave.pairs), { id : crp.id }))));
                            if(target){
                                wave.pairs[creep.id] = target.id;
                                console.log('assigned', creep.name, 'to', target.name);
                            }else{
                                console.log('no assignment found for', creep.name);
                            }
                        }
                    }
                }
            }
            switch(wave.stage){
                case 'gather':
                    var waypoint = Movement.getWaypoint(squadId, wave, config);
                    if(waypoint){
                            Movement.moveToWaypoint(squadId, wave, config, waypoint);
                    }else{
                        console.log('Invalid movement state, no waypoint!', squadId, wave.state, wave.waypoint);
                    }
                break;
                case 'approach':
                    var approach = _.first(Movement.getPosList(squadId, wave, config, 'approach'));

                break;
                case 'breach':
                break;
                case 'attack':
                break;
            }
        }
    }

    static moveToWaypoint(squadId, config, wave, creeps, waypoint){
        var arrived = true;
        for(let creep of creeps){
            var dist = creep.pos.getRangeTo(waypoint);
            if(dist > 2){
                Pathing.attackMove(creep, { pos: waypoint }, 2);
                arrived = false;
            }
        }
        if(arrived && !wave.recruiting){
            console.log(squadId, 'Arrived at waypoint:', waypoint);
            if((wave.waypoint + 1) < config.waypoints.length){
                wave.waypoint++;
                console.log(squadId, 'Moving to next waypoint...');
            }else{
                console.log(squadId, 'Reached final waypoint!');
                wave.waypoint = false;
                wave.stage = 'approach';
            }
        }
    }
}

module.exports = Movement;