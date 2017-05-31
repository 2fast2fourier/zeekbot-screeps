
const Util = require('./util');

class DefenseMatrix {
    startup(){
        let flags = Flag.getByPrefix('tower');
        for(let flag of flags){
            if(flag.room){
                flag.room.visual.rect(flag.pos.x - 5.5, flag.pos.y - 5.5, 11, 11, {
                    fill: '#ff0000',
                    opacity: 0.1
                });
                flag.room.visual.rect(flag.pos.x - 10.5, flag.pos.y - 10.5, 21, 21, {
                    fill: '#ff0000',
                    opacity: 0.1
                });
                flag.room.visual.rect(flag.pos.x - 20.5, flag.pos.y - 20.5, 41, 41, {
                    fill: '#ff0000',
                    opacity: 0.1
                });
            }
        }
        if(Game.flags.clearTower){
            flags.forEach(flag => flag.remove());
            Game.flags.clearTower.remove();
        }
    }

    process(cluster){

    }
}

module.exports = DefenseMatrix;