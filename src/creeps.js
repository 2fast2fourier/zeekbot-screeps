"use strict";

var haulerParts = {
    mega: { carry: 32, move: 16 },//2400
    kilo: { carry: 24, move: 12 },//1500
    milli: { carry: 16, move: 8 },//1200
    micro: { carry: 8, move: 8 },//800
    nano: { carry: 5, move: 5 },//550
    pico: { carry: 3, move: 3 }//300
};

var template = {
    defender: {
        quota: 'defend-defend',
        critical: true,
        parts: {
            micro: { tough: 5, move: 15, ranged_attack: 10 },
            nano: { tough: 5, move: 10, ranged_attack: 5 },
            pico: { tough: 5, move: 7, ranged_attack: 2 },
            femto: { tough: 2, move: 4, ranged_attack: 2 }
        },
        work: { defend: {}, idle: { subtype: 'tower' } },
        variants: {
            rampart: {
                quota: 'rampart-defend',
                parts: {
                    milli: { attack: 40, move: 10 },
                },
                work: { defend: { subtype: 'rampart' } },
                behavior: { rampart: { range: 1 } }
            }
        }
    },
    longbow: {
        quota: 'longbow-defend',
        critical: true,
        boost: {
            milli: { fatigue: 10, rangedAttack: 40 }
        },
        parts: {
            milli: { ranged_attack: 40, move: 10 }//,
            // micro: { ranged_attack: 40, move: 10 }
        },
        work: { defend: { subtype: 'longbow' } },
        behavior: { boost: { required: true }, rampart: { range: 3 } }
    },
    spawnhauler: {
        quota: 'spawnhauler',
        allocation: 'carry',
        allocationMulti: 50,
        critical: true,
        assignRoom: 'spawn',
        parts: haulerParts,
        emergency: 'pico',
        work: {
            pickup: { local: true },
            deliver: { subtype: 'spawn', local: true },
            idle: { subtype: 'spawn', local: true }
        },
        behavior: { },
        variants: {
            fallback: {
                emergency: false,
                allocationMulti: 100,
                parts: { pico: {carry: 4, move: 2 } }
            },
            tower: {
                emergency: false,
                allocationMulti: 50,
                quota: 'tower-deliver',
                assignRoom: 'tower',
                work: {
                    pickup: { local: true },
                    deliver: { subtype: 'tower', local: true },
                    idle: { subtype: 'tower', local: true }
                },
                behavior: { avoid: {} }
            }
        }
    },
    energyminer: {
        quota: 'energy-mine',
        critical: true,
        allocation: 'work',
        allocationMax: 6,
        parts: {
            kilo: { move: 6, carry: 4, work: 6 },
            milli: { move: 4, carry: 2, work: 6 },//standard 1100
            micro: { move: 3, carry: 1, work: 6 },//800
            nano: { move: 2, carry: 2, work: 3 },//550
            pico: { move: 1, carry: 1, work: 2 }//300
        },
        emergency: 'pico',
        work: { mine: { subtype: 'energy' } },
        behavior: { avoid: {}, minecart: {} }
    },
    hauler: {
        quota: 'harvesthauler',
        allocation: 'carry',
        allocationMax: 24,
        parts: haulerParts,
        assignRoom: 'harvest',
        work: {
            pickup: { subtype: 'harvest', local: true },
            deliver: { subtype: 'storage' }
        },
        behavior: { avoid: {} },
        variants: {
            stockpile: {
                quota: 'stockpile-deliver',
                allocationMulti: 50,
                allocationMax: Infinity,
                work: { 
                    pickup: {},
                    deliver: { subtype: 'stockpile' },
                    idle: { subtype: 'spawn' }
                },
                assignRoom: false
            },
            mineral: {
                quota: 'mineral-pickup',
                allocationMulti: 50,
                allocationMax: Infinity,
                parts: { 
                    milli: { carry: 24, move: 12 },
                    micro: { carry: 16, move: 8 }
                },
                work: {
                    pickup: { subtype: 'mineral' },
                    deliver: { subtype: 'terminal' },
                    idle: { subtype: 'extractor' }
                },
                assignRoom: false
            }
        }
    },
    reserver: {
        quota: 'reserve',
        allocation: 'claim',
        allocationMax: 2,
        critical: false,
        parts: {
            micro: { claim: 4, move: 4 },
            nano: { claim: 2, move: 2 },
            pico: { claim: 1, move: 1 }
        },
        work: { reserve: {} },
        behavior: { avoid: {} },
        variants: {
            downgrade: {
                quota: 'downgrade',
                allocation: 1,
                allocationMax: 4,
                critical: false,
                work: { downgrade: { } },
                parts: { pico: { claim: 5, move: 5 } }
            }
        }
    },
    keeper: {
        quota: 'keep',
        assignRoom: 'keep',
        parts: {
            milli: { move: 25, ranged_attack: 2, attack: 18, heal: 5 },
            micro: { tough: 6, move: 25, attack: 15, heal: 4 },
            nano: { tough: 14, move: 17, attack: 15, heal: 4 }
            // pico: { tough: 15, move: 15, attack: 15 }//TODO enable RCL6 SK?
        },
        work: { keep: { local: true } },//, defend: {}//TODO defend tooo
        behavior: { selfheal: {} }
    },
    builderworker: {
        quota: 'build',
        maxQuota: 20000,
        allocation: 'work',
        allocationMulti: 1000,
        parts: {
            mega: { move: 15, carry: 20, work: 10 },
            kilo: { move: 17, carry: 12, work: 5 },//1700
            milli: { move: 10, carry: 6, work: 4 },//1200
            micro: { move: 7, carry: 5, work: 2 },//800
            nano: { move: 4, carry: 2, work: 2 },//550
            pico: { move: 2, carry: 1, work: 1 }//300
        },
        work: { pickup: { priority: 5 }, build: {}, repair: { priority: 99 } },
        behavior: { avoid: {} }
    },
    upgradeworker: {
        quota: 'upgrade',
        allocation: 'work',
        parts: {
            //mega: { work: 15, move: 24, carry: 9 },//2700
            kilo: { work: 15, move: 9, carry: 3 },//2100
            milli: { work: 5, move: 6, carry: 6 },//1200
            micro: { work: 5, move: 4, carry: 2 },//800
            nano: { move: 3, carry: 4, work: 2 },//550
            pico: { move: 2, carry: 1, work: 1 }//300
        },
        work: { pickup: {}, upgrade: {}, idle: { subtype: 'controller' } },
        behavior: { energy: {}, avoid: {} }
    },
    repairworker: {
        quota: 'repair-repair',
        allocation: 5,
        maxQuota: 20,
        parts: {
            kilo: { move: 10, carry: 10, work: 10 },
            milli: { move: 6, carry: 7, work: 5 },//1150
            micro: { move: 7, carry: 5, work: 2 },//800
            nano: { move: 5, carry: 4, work: 1 },//550
            pico: { move: 2, carry: 1, work: 1 }//300
        },
        work: { pickup: { priority: 1 }, repair: { subtype: 'repair' }, idle: { subtype: 'spawn' } },
        behavior: { avoid: {}, repair: {} },
        variants: {
            heavy: {
                quota: 'heavy-repair',
                allocation: 3,
                maxQuota: 20,
                parts: {
                    micro: { move: 16, carry: 12, work: 20 },
                    nano: { move: 10, carry: 10, work: 10 },
                    pico: { move: 6, carry: 7, work: 5 },
                    femto: { move: 2, carry: 1, work: 1 }
                },
                work: { pickup: { priority: 1 }, repair: { subtype: 'heavy' }, idle: { subtype: 'spawn' } },
                behavior: { avoid: {}, boost: {} }
            },
            bunker: {
                quota: 'bunker-repair',
                allocation: 1,
                maxQuota: 4,
                boost: {
                    milli: { repair: 20 }
                },
                parts: {
                    milli: { move: 16, carry: 12, work: 20 },
                    micro: { move: 16, carry: 12, work: 20 },
                    nano: { move: 10, carry: 10, work: 10 },
                    pico: { move: 6, carry: 7, work: 5 },
                    femto: { move: 2, carry: 1, work: 1 }
                },
                work: { pickup: { priority: 1 }, repair: { subtype: 'bunker' }, idle: { subtype: 'storage' } },
                behavior: { avoid: {}, boost: {} }
            }
        }
    },
    observer: {
        quota: 'observe',
        critical: true,
        parts: { pico: { move: 1 } },
        work: { observe: {} },
        behavior: { avoid: {} },
        variants: {
            poker: {
                quota: 'poke-observe',
                work: { observe: { subtype: 'poke' } }
            }
        }
    },
    healer: {
        quota: 'heal',
        maxQuota: 1,
        parts: {
            micro: { move: 4, heal: 4 },
            nano: { move: 2, heal: 2 },
            pico: { move: 1, heal: 1 }
        },
        work: { heal: {} },
        behavior: { avoid: {} }
    },
    mineralminer: {
        quota: 'mineral-mine',
        allocation: 'work',
        allocationMax: 6,
        parts: {
            milli: { move: 12, carry: 4, work: 24 },
            nano: { move: 8, carry: 4, work: 16 },
            pico: { move: 4, carry: 4, work: 8 }
        },
        work: { mine: { subtype: 'mineral' } },
        behavior: { avoid: {}, minecart: {} }
    },
    transferhauler: {
        quota: 'transfer',
        critical: true,
        maxQuota: 3,
        allocation: 1,
        parts: { milli: { carry: 20, move: 10 } },
        work: {
            transfer: {},
            deliver: { subtype: 'terminal', priority: 99 },
            idle: { subtype: 'terminal' }
        },
        behavior: { avoid: {} }
    },
    dismantler: {
        quota: 'dismantle',
        allocation: 'work',
        allocationMulti: 75000,
        maxQuota: 5000000,
        parts: {
            mega: { work: 25, move: 25 },
            kilo: { work: 15, move: 15 },
            milli: { work: 12, move: 12 },
            micro: { work: 8, move: 8 },
            nano: { work: 5, move: 5 },
            pico: { work: 2, move: 2 }
        },
        work: { dismantle: {} },
        behavior: { avoid: {} }
    },
    attacker: {
        quota: 'attack',
        maxQuota: 6,
        critical: true,
        boost: {
            milli: { fatigue: 10, damage: 5, rangedAttack: 25, heal: 10 }
        },
        parts: {
            milli: { tough: 5, ranged_attack: 25, move: 10, heal: 10 }
        },
        work: { attack: {} },
        behavior: { selfheal: { auto: true }, rampart: { range: 3 }, boost: {} }
    }
}

function buildCreeplist(creeps){
    var result = _.cloneDeep(creeps);
    for(var type in creeps){
        var config = creeps[type];
        if(config.variants){
            for(var variant in config.variants){
                var modification = config.variants[variant];
                result[variant+'-'+type] = _.assign(_.cloneDeep(creeps[type]), modification);
            }
        }
    }
    return result;
}

module.exports = buildCreeplist(template);