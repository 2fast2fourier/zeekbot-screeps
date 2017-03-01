"use strict";

var haulerParts = {
    mega: { carry: 32, move: 16 },//2400
    kilo: { carry: 24, move: 12 },//1500
    milli: { carry: 16, move: 8 },//1200
    micro: { carry: 8, move: 8 },//800
    nano: { carry: 5, move: 5 },//550
    pico: { carry: 3, move: 3 }//300
};

module.exports = {
    defender: {
        quota: 'defend',
        critical: true,
        parts: {
            // micro: { tough: 3, move: 11, ranged_attack: 8 },
            nano: { tough: 5, move: 10, ranged_attack: 5 },
            pico: { tough: 5, move: 7, ranged_attack: 2 },
            femto: { tough: 2, move: 4, ranged_attack: 2 }
        },
        work: { defend: {}, observe: { onlyReveal: true }, idle: { subtype: 'tower' } }
    },
    spawnhauler: {
        quota: 'spawnhauler',
        critical: true,
        assignRoom: 'spawn',
        parts: haulerParts,
        emergency: 'pico',
        work: { 
            pickup: { local: true },
            deliver: { subtype: 'spawn', local: true },
            idle: { subtype: 'spawn', local: true }
        },
        behavior: { avoid: {} }
    },
    energyminer: {
        quota: 'energy-mine',
        critical: true,
        allocation: 'work',
        allocationMax: 6,
        parts: {
            milli: { move: 4, carry: 2, work: 8 },//standard 1100
            micro: { move: 3, carry: 1, work: 6 },//800
            nano: { move: 2, carry: 2, work: 3 },//550
            pico: { move: 1, carry: 1, work: 2 }//300
        },
        emergency: 'pico',
        work: { mine: { subtype: 'energy' } },
        behavior: { avoid: {}, minecart: {} }
    },
    stockpilehauler: {
        quota: 'stockpile-deliver',
        allocation: 'carry',
        allocationMulti: 50,
        parts: haulerParts,
        work: { 
            pickup: {},
            deliver: { subtype: 'stockpile' }
        },
        behavior: { avoid: {} }
    },
    harvesthauler: {
        quota: 'harvesthauler',
        allocation: 'carry',
        allocationMax: 24,
        parts: haulerParts,
        assignRoom: 'harvest',
        work: {
            pickup: { subtype: 'harvest' },
            deliver: { subtype: 'storage' }
        },
        behavior: { avoid: {} }
    },
    reserver: {
        quota: 'reserve',
        allocation: 'claim',
        allocationMax: 2,
        parts: {
            micro: { claim: 4, move: 4 },
            nano: { claim: 2, move: 2 },
            pico: { claim: 1, move: 1 }
        },
        work: { reserve: {} },
        behavior: { avoid: {} }
    },
    builderworker: {
        quota: 'build',
        maxQuota: 10000,
        allocation: 'work',
        allocationMulti: 1000,
        parts: {
            kilo: { move: 17, carry: 12, work: 5 },//1700
            milli: { move: 10, carry: 6, work: 4 },//1200
            micro: { move: 7, carry: 5, work: 2 },//800
            nano: { move: 4, carry: 2, work: 2 },//550
            pico: { move: 2, carry: 1, work: 1 }//300
        },
        work: { pickup: {}, build: {}, repair: { priority: 99 }, idle: { subtype: 'controller' } },
        behavior: { avoid: {} }
    },
    upgradeworker: {
        quota: 'upgrade',
        allocation: 'work',
        parts: {
            kilo: { work: 10, move: 6, carry: 2 },//1400
            milli: { work: 5, move: 6, carry: 6 },//1200
            micro: { work: 5, move: 4, carry: 2 },//800
            nano: { move: 3, carry: 4, work: 2 },//550
            pico: { move: 2, carry: 1, work: 1 }//300
        },
        work: { pickup: {}, upgrade: {}, idle: { subtype: 'controller' } },
        behavior: { energy: {}, avoid: {} }
    },
    repairworker: {
        quota: 'repair',
        allocation: 'work',
        allocationMulti: 8000,
        maxQuota: 200000,
        parts: {
            milli: { move: 6, carry: 7, work: 5 },//1150
            micro: { move: 7, carry: 5, work: 2 },//800
            nano: { move: 5, carry: 4, work: 1 },//550
            pico: { move: 2, carry: 1, work: 1 }//300
        },
        work: { pickup: {}, repair: {}, idle: { subtype: 'controller' } },
        behavior: { avoid: {}, repair: {} }
    },
    observer: {
        quota: 'observe',
        critical: true,
        parts: { pico: { tough: 1, move: 1 } },
        work: { observe: {} },
        behavior: { avoid: {} }
    },
    healer: {
        quota: 'heal',
        maxQuota: 1,
        parts: {
            micro: { move: 4, heal: 4 },
            nano: { move: 2, heal: 2 },
            pico: { move: 1, heal: 1 }
        },
        work: { heal: {} }
    },
    mineralminer: {
        quota: 'mineral-mine',
        allocation: 'work',
        allocationMax: 6,
        parts: {
            pico: { move: 6, carry: 4, work: 8 }
        },
        work: { mine: { subtype: 'mineral' } },
        behavior: { avoid: {}, minecart: {} }
    },
    mineralhauler: {
        quota: 'mineral-pickup',
        allocation: 'carry',
        allocationMulti: 50,
        parts: { milli: { carry: 16, move: 8 } },
        work: {
            pickup: { subtype: 'mineral' },
            deliver: { subtype: 'terminal' }
        },
        behavior: { avoid: {} }
    },
    transferhauler: {
        quota: 'transfer',
        maxQuota: 1,
        parts: { milli: { carry: 20, move: 10 } },
        work: {
            transfer: {},
            deliver: { subtype: 'terminal', priority: 99 },
            idle: { subtype: 'terminal' }
        },
        behavior: { avoid: {} }
    }
}