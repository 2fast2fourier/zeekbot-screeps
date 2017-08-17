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
            },
            heavy: {
                quota: 'heavy-defend',
                allocation: 1,
                maxQuota: 1,
                boost: {
                    milli: { fatigue: 5, rangedAttack: 10, heal: 5 }
                },
                parts: {
                    milli: { tough: 5, move: 5, ranged_attack: 10, heal: 5 }
                },
                work: { defend: { subtype: 'heavy' }, idle: { subtype: 'spawn' } },
                behavior: { selfheal: { auto: true }, boost: {}, recycle: {} }
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
                parts: { pico: { carry: 20, move: 10 } }
            },
            tower: {
                emergency: false,
                allocation: 'carry',
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
            mega: { work: 10, carry: 4, move: 5 },//1450
            kilo: { carry: 4, work: 6, move: 6 },
            milli: { carry: 2, work: 6, move: 4 },//standard 1100
            micro: { carry: 1, work: 6, move: 3 },//800
            nano: { carry: 2, work: 3, move: 2 },//550
            pico: { carry: 1, work: 2, move: 1 }//300
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
            pickup: { subtype: 'harvest', local: true, priority: 0 },
            deliver: { subtype: 'storage', priority: 0.25 },
            idle: {}
        },
        behavior: { avoid: {} },
        variants: {
            stockpile: {
                quota: 'stockpile-deliver',
                allocation: 1,
                maxQuota: 3,
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
                parts: {
                    mega: { claim: 10, move: 10 },
                    pico: { claim: 5, move: 5 }
                }
            }
        }
    },
    keeper: {
        quota: 'keep',
        assignRoom: 'keep',
        parts: {
            milli: { move: 25, ranged_attack: 20, heal: 5 }
        },
        offset: 100,
        work: { keep: { local: true } },
        behavior: { avoid: { fleeOnly: true, threshold: { heal: 140 } }, defend: { type: 'invader', limit: { heal: 140 }, autoheal: true } }
    },
    builderworker: {
        quota: 'build',
        maxQuota: 24000,
        allocation: 'work',
        allocationMulti: 1000,
        boost: {
            giga: { repair: 12 }
        },
        parts: {
            giga: { move: 16, carry: 20, work: 12 },
            mega: { move: 15, carry: 20, work: 10 },
            kilo: { move: 17, carry: 12, work: 5 },//1700
            milli: { move: 10, carry: 6, work: 4 },//1200
            micro: { move: 7, carry: 5, work: 2 },//800
            nano: { move: 4, carry: 2, work: 2 },//550
            pico: { move: 2, carry: 1, work: 1 }//300
        },
        work: { pickup: { priority: 5 }, build: {}, repair: { priority: 99 } },
        behavior: { avoid: {}, boost: {} }
    },
    upgradeworker: {
        quota: 'upgrade-upgrade',
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
        behavior: { energy: {}, avoid: {} },
        variants: {
            level: {
                quota: 'levelroom-upgrade',
                boost: {
                    nano: { upgradeController: 15 }
                },
                parts: {
                    nano: { work: 15, move: 14, carry: 12 },
                    pico: { work: 15, move: 9, carry: 3 }
                },
                behavior: { energy: {}, avoid: {}, boost: {} },
                work: { pickup: {}, upgrade: { subtype: 'levelroom' }, idle: { subtype: 'controller' } },
            }
        }
    },
    repairworker: {
        quota: 'repair-repair',
        allocation: 3,
        maxQuota: 30,
        parts: {
            kilo: { carry: 10, work: 10, move: 10 },
            milli: { carry: 7, work: 5, move: 6 },//1150
            micro: { carry: 5, work: 2, move: 7 },//800
            nano: { carry: 4, work: 1, move: 5 },//550
            pico: { carry: 1, work: 1, move: 2 }//300
        },
        work: { pickup: { priority: 1 }, repair: { subtype: 'repair' }, idle: { subtype: 'gather' } },
        behavior: { avoid: {}, repair: {} },
        variants: {
            heavy: {
                quota: 'heavy-repair',
                allocation: 3,
                maxQuota: 20,
                boost: {
                    milli: { repair: 20, capacity: 12 }
                },
                parts: {
                    milli: { carry: 12, work: 20, move: 16 },
                    micro: { carry: 10, work: 20, move: 15 },
                    nano: { carry: 10, work: 10, move: 16 },
                    pico: { carry: 7, work: 5, move: 16 },
                    femto: { carry: 1, work: 1, move: 16 }
                },
                work: { pickup: { priority: 1 }, repair: { subtype: 'heavy' }, idle: { subtype: 'gather' }, build: { priority: 50 } },
                behavior: { avoid: {}, boost: {}, recycle: {} }
            },
            special: {
                boost: {
                    milli: { repair: 20, capacity: 10 }
                },
                parts: {
                    milli: { move: 15, carry: 10, work: 20 },
                    micro: { move: 13, carry: 10, work: 15 },
                    nano: { move: 10, carry: 10, work: 10 },
                    pico: { move: 6, carry: 7, work: 5 },
                    femto: { move: 2, carry: 1, work: 1 }
                },
                work: { pickup: { priority: 1 }, repair: { subtype: 'special' }, idle: { subtype: 'gather' } },
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
    mineralminer: {
        quota: 'mineral-mine',
        allocation: 'work',
        allocationMax: 6,
        parts: {
            milli: { carry: 4, work: 24, move: 12 },
            nano: { move: 8, carry: 4, work: 16 },
            pico: { move: 4, carry: 4, work: 8 }
        },
        work: { mine: { subtype: 'mineral' }, idle: { subtype: 'gather' } },
        behavior: { avoid: {}, minecart: {} }
    },
    transferhauler: {
        quota: 'transfer',
        critical: true,
        maxQuota: 6,
        allocation: 2,
        parts: { milli: { carry: 20, move: 10 } },
        work: {
            transfer: {},
            deliver: { subtype: 'terminal', priority: 50 },
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
        work: { dismantle: {}, idle: {} },
        behavior: { avoid: {}, recycle: {} }
    },
    keephealer: {
        quota: 'heal',
        maxQuota: 1,
        critical: true,
        parts: {
            pico: { move: 5, heal: 5 }
        },
        work: { heal: {} },
        behavior: { avoid: {} }
    },
    attacker: {
        quota: 'attack-squad',
        maxQuota: 4,
        critical: true,
        boost: {
            pico: { fatigue: 10, attack: 30, damage: 10 }
        },
        parts: {
            pico: { tough: 10, attack: 30, move: 10 }
        },
        work: { squad: { subtype: 'attack' } },
        behavior: { boost: {} }
    },
    healer: {
        quota: 'heal-squad',
        maxQuota: 4,
        critical: true,
        boost: {
            pico: { fatigue: 10, heal: 30, damage: 10 }
        },
        parts: {
            pico: { tough: 10, heal: 30, move: 10 }
        },
        work: { squad: { subtype: 'heal' } },
        behavior: { boost: {} }
    },
    ranger: {
        quota: 'ranged-squad',
        maxQuota: 4,
        critical: true,
        boost: {
            pico: { fatigue: 10, rangedAttack: 30, damage: 10 }
        },
        parts: {
            pico: { tough: 10, ranged_attack: 30, move: 10 }
        },
        work: { squad: { subtype: 'ranged' } },
        behavior: { boost: {} }
    },
    breakthrough: {
        quota: 'dismantle-squad',
        maxQuota: 4,
        critical: true,
        boost: {
            pico: { fatigue: 10, dismantle: 30, damage: 10 }
        },
        parts: {
            pico: { tough: 10, work: 30, move: 10 }
        },
        work: { squad: { subtype: 'dismantle' } },
        behavior: { boost: {} }
    },
    holder: {
        quota: 'attack',
        maxQuota: 1,
        critical: true,
        boost: {
            pico: { fatigue: 10, rangedAttack: 25, damage: 10, heal: 5 }
        },
        parts: {
            pico: { tough: 10, ranged_attack: 25, move: 10, heal: 5 },
            femto: { ranged_attack: 25, move: 25 }
        },
        work: { attack: { } },
        behavior: { boost: {}, rampart: { range: 3 }, selfheal: { auto: true } }
    }
}

function buildCreeplist(creeps){
    var result = _.cloneDeep(creeps);
    for(var type in creeps){
        var config = creeps[type];
        config.type = type;
        if(config.variants){
            for(var variant in config.variants){
                var modification = config.variants[variant];
                var variantType = variant+'-'+type;
                result[variantType] = _.assign(_.cloneDeep(creeps[type]), modification, { type: variantType });
            }
        }
    }
    return result;
}

module.exports = buildCreeplist(template);