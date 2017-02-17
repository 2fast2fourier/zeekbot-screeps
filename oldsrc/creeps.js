"use strict";

module.exports = {
    miner: {
        versions: {
            energy: {
                allocation: 7,
                critical: true,
                parts: { move: 4, carry: 2, work: 8 }
            },
            milli: {
                allocation: 7,
                max: 0,
                parts: { move: 4, carry: 2, work: 8 }
            },
            mineral: {
                allocation: 5,
                quota: 'mine-mineral',
                parts: { move: 5, carry: 2, work: 8 },
                boostOptional: true,
                boost: { UO: 8 },
                rules: { mine: { subtype: 'mineral' }, drop: { priority: 5 } }
            }
        },
        quota: 'mine-energy',
        rules: {
            mine: { subtype: 'energy' },
            drop: { priority: 5 }
        },
        actions: { avoid: {}, minecart: {} }
    },
    hauler: {
        versions: {
            spawn: {
                quota: 'spawnhauler',
                critical: true,
                parts: {carry: 32, move: 16},
                rules: {
                    pickup: { subtype: false, local: true },
                    deliver: { subtype: 'spawn', local: true },
                    idle: { type: 'spawn' }
                },
                actions: { assignRoom: { type: 'spawn' } }
            },
            transfer: {
                quota: 'transfer',
                allocation: 2,
                max: 8,
                rules: { transfer: {}, deliver: { minerals: true, mineralTypes: [ STRUCTURE_STORAGE ], priority: 99 } },
                parts: {carry: 10, move: 10}
            },
            stockpile: {
                quota: 'stockpilehauler',
                rules: {
                    pickup: { subtype: false, types: [ STRUCTURE_STORAGE ] },
                    deliver: { local: true, subtype: 'stockpile' }
                },
                actions: { avoid: {}, assignRoom: { type: 'stockpile' } },
                parts: { carry: 30, move: 15 }
            },
            leveler: {
                quota: 'levelerhauler',
                max: 8,
                rules: {
                    pickup: { distanceWeight: 150, subtype: 'level' },
                    deliver: { types: [ STRUCTURE_STORAGE ], ignoreCreeps: true, ignoreDistance: true }
                },
                parts: { carry: 30, move: 15 }
            },
            long: {
                quota: 'longhauler',
                rules: {
                    pickup: { local: true, types: [ STRUCTURE_CONTAINER ], subtype: 'remote' },
                    deliver: { types: [ STRUCTURE_STORAGE ], ignoreCreeps: true, profile: true }
                },
                parts: { carry: 32, move: 16 },
                actions: { avoid: {}, assignRoom: { type: 'pickup' } }
            },
            mineral: {
                quota: 'pickup-mineral',
                allocation: 1500,
                max: 4,
                parts: { carry: 20, move: 10 },
                rules: {
                    pickup: { subtype: 'mineral', minerals: true, types: [ STRUCTURE_CONTAINER ] },
                    deliver: { subtype: false }
                }
            }
        },
        actions: { avoid: {} }
    },
    observer: {
        versions: {
            soaker: {
                quota: 'observe-soak',
                max: 1,
                boost: { XLHO2: 10, XGHO2: 10 },
                parts: { tough: 10, move: 10, heal: 10 },
                memory: { ignoreHealth: true },
                rules: { observe: { subtype: 'soak' } },
                actions: { boost: {}, selfheal: {} }
            },
            pico: {
                quota: 'observe',
                parts: {tough: 1, move: 1},
                memory: { ignoreHealth: true },
                rules: { observe: { subtype: false } }
            }
        }
    },
    worker: {
        versions: {
            builder: {
                quota: 'build',
                allocation: 3,
                max: 4,
                boostOptional: true,
                boost: { XLH2O: 5 },
                rules: {
                    pickup: {},
                    build: {},
                    repair: { priority: 99 }
                },
                parts: { work: 5, carry: 10, move: 15 }
            },
            upgrade: {
                quota: 'upgrade',
                allocation: 15,
                parts: { work: 15, carry: 3, move: 9 },
                rules: { pickup: {}, upgrade: {} }
            },
            repair: {
                quota: 'repair',
                max: 14,
                rules: { pickup: {}, repair: {} },
                actions: { avoid: {}, repair: {} },
                parts: { work: 5, carry: 10, move: 8 }
            },
            dismantle: {
                quota: 'dismantle',
                max: 2,
                allocation: 2000000,
                boostOptional: true,
                boost: { XZH2O: 10 },
                rules: { dismantle: {} },
                actions: { boost: {} },
                parts: { work: 10, move: 10 }
            }
        },
        actions: { avoid: {}, energy: {} }
    },
    claimer: {
        versions: {
            attack: {
                parts: { claim: 10, move: 10 },
                quota: 'reserve-downgrade',
                allocation: 10,
                max: 4,
                rules: { reserve: { downgrade: true } }
            },
            pico: {
                parts: { claim: 2, move: 2 },
                quota: 'reserve-reserve',
                allocation: 2,
                rules: { reserve: { subtype: 'reserve' } }
            }
        },
    },
    healer: {
        versions: {
            pico: {
                quota: 'heal',
                max: 1,
                parts: { tough: 4, move: 8, heal: 4 }
            }
        },
        rules: { heal: {}, idle: { type: 'heal' } }
    },
    fighter: {
        versions: {
            melee: {
                critical: true,
                quota: 'keep',
                memory: { ignoreHealth: true },
                parts: { tough: 14, move: 17, attack: 15, heal: 4 },
                actions: { selfheal: {}, assignRoom: { type: 'keep' } }
            },
            ranged: {
                quota: 'idle-defend',
                max: 4,
                parts: { tough: 10, move: 10, ranged_attack: 10 },
                rules: { defend: { ranged: true }, idle: { type: 'defend' } }
            },
            assault: {
                critical: true,
                quota: 'idle-assault',
                allocation: 1,
                max: 4,
                boost: { XLHO2: 10, XGHO2: 5 },//XUH2O: 10, 
                parts: { tough: 5, move: 25, attack: 10, heal: 10 },
                actions: { boost: {}, selfheal: { block: true } },
                rules: { attack: { subtype: 'assault' }, idle: { type: 'assault' } }
            },
            attack: {
                quota: 'idle-attack',
                max: 2,
                allocation: 1,
                parts: { tough: 17, move: 16, attack: 15 },
                rules: { attack: { subtype: 'attack' }, idle: { type: 'attack' } }
            },
            raider: {
                quota: 'idle-raid',
                allocation: 1,
                boost: { XUH2O: 15 }, 
                parts: { move: 15, attack: 15 },
                rules: { attack: { subtype: 'raid' }, idle: { type: 'raid' } }
            },
            picket: {
                quota: 'idle-picket',
                allocation: 1,
                parts: { move: 5, attack: 5 },
                rules: { attack: { subtype: 'picket' }, idle: { type: 'picket' } }
            }
        },
        rules: { defend: {}, keep: { local: true } }
    }
};