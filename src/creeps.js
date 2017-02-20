"use strict";

var haulerParts = {
    full: { carry: 32, move: 16 },//2400
    micro: { carry: 20, move: 10 },//1500
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
            micro: { tough: 3, move: 11, ranged_attack: 8 },
            nano: { tough: 5, move: 10, ranged_attack: 5 },
            pico: { tough: 5, move: 7, ranged_attack: 2 }
        },
        work: { defend: {} }
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
        work: { mine: { subtype: 'energy' } },
        behavior: { minecart: {} }// avoid: {},
    },
    spawnhauler: {
        quota: 'spawnhauler',
        critical: true,
        assignRoom: 'spawn',
        parts: haulerParts,
        work: { 
            pickup: { local: true },
            deliver: { subtype: 'spawn', local: true }
        },
        // behavior: { avoid: {} }
    },
    stockpilehauler: {
        quota: 'stockpile-deliver',
        maxQuota: 4000,
        allocation: 'carry',
        allocationMulti: 200,
        parts: haulerParts,
        work: { 
            pickup: {},
            deliver: { subtype: 'stockpile' }
        },
        // behavior: { avoid: {} }
    },
    harvesthauler: {
        quota: 'harvesthauler',
        parts: haulerParts,
        assignRoom: 'harvest',
        work: {
            pickup: { subtype: 'harvest' },
            deliver: { subtype: 'storage' }
        },
        // behavior: { avoid: {} }
    },
    builderworker: {
        quota: 'build',
        maxQuota: 10000,
        allocation: 'work',
        allocationMulti: 1000,
        parts: {
            milli: { move: 10, carry: 6, work: 4 },//1200
            micro: { move: 7, carry: 5, work: 2 },//800
            nano: { move: 4, carry: 2, work: 2 },//550
            pico: { move: 2, carry: 1, work: 1 }//300
        },
        work: { pickup: {}, build: {}, repair: { priority: 99 } },
        // behavior: { avoid: {} }
    },
    upgradeworker: {
        quota: 'upgrade',
        allocation: 'work',
        parts: {
            micro: { move: 7, carry: 4, work: 10 },//1550
            milli: { move: 6, carry: 6, work: 5 },//1200
            micro: { move: 4, carry: 2, work: 5 },//800
            nano: { move: 3, carry: 4, work: 2 },//550
            pico: { move: 2, carry: 1, work: 1 }//300
        },
        work: { pickup: {}, upgrade: {} },
        // behavior: { avoid: {} }
    },
    repairworker: {
        quota: 'repair',
        allocation: 'work',
        allocationMulti: 10000,
        maxQuota: 40000,
        parts: {
            milli: { move: 10, carry: 6, work: 4 },//1200
            micro: { move: 7, carry: 5, work: 2 },//800
            nano: { move: 5, carry: 4, work: 1 },//550
            pico: { move: 2, carry: 1, work: 1 }//300
        },
        work: { pickup: {}, repair: {} },
        behavior: { repair: {} }// avoid: {}, 
    },
    observer: {
        quota: 'observe',
        parts: { pico: { tough: 1, move: 1 } },
        work: { observe: {} }
    },
    reserver: {
        quota: 'reserve',
        allocation: 'claim',
        parts: {
            nano: { claim: 2, move: 2 },
            pico: { claim: 1, move: 1 }
        },
        work: { reserve: {} }
    }
}