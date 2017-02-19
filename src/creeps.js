"use strict";

module.exports = {
    energyminer: {
        quota: 'energy-mine',
        critical: true,
        allocation: 'work',//TODO scale allocation on part/boost
        parts: {
            milli: { move: 4, carry: 2, work: 8 },//standard 1100
            micro: { move: 3, carry: 1, work: 6 },//800
            nano: { move: 2, carry: 1, work: 4 },//550
            pico: { move: 1, carry: 1, work: 2 }//300
        },
        work: { mine: { subtype: 'energy' } },
        behavior: { avoid: {}, minecart: {}, drop: {} }
    },
    spawnhauler: {
        quota: 'spawnhauler',
        critical: true,
        assignRoom: 'spawn',
        parts: {
            full: { carry: 32, move: 16 },//2400
            micro: { carry: 20, move: 10 },//1500
            milli: { carry: 10, move: 10 },//1000
            micro: { carry: 8, move: 8 },//800
            nano: { carry: 5, move: 5 },//550
            pico: { carry: 3, move: 3 }//300
        },
        work: { 
            pickup: { local: true },
            deliver: { subtype: 'spawn', local: true }
        },
        behavior: { avoid: {} }
    },
    builderworker: {
        quota: 'build',
        allocation: 1000,//TODO scale allocation on part/boost
        max: 4,
        parts: {
            milli: { move: 10, carry: 6, work: 4 },//1200
            micro: { move: 7, carry: 5, work: 2 },//800
            nano: { move: 3, carry: 4, work: 2 },//550
            pico: { move: 2, carry: 1, work: 1 }//300
        },
        work: { pickup: {}, build: {} },
        behavior: { avoid: {} }
    },
    upgradeworker: {
        quota: 'upgrade',
        allocation: 'work',
        parts: {
            milli: { move: 10, carry: 6, work: 4 },//1200
            micro: { move: 7, carry: 5, work: 2 },//800
            nano: { move: 3, carry: 4, work: 2 },//550
            pico: { move: 2, carry: 1, work: 1 }//300
        },
        work: { pickup: {}, upgrade: {} },
        behavior: { avoid: {} }
    }
}