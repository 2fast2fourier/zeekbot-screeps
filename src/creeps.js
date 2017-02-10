"use strict";

module.exports = {
    miner: {
        versions: {
            boost: {
                allocation: 7,
                critical: true,
                parts: { move: 1, carry: 2, work: 1},
                boost: { XUHO2: 1 }
            },
            milli: {
                allocation: 7,
                critical: true,
                parts: { move: 4, carry: 2, work: 8 }
            },
            boostmineral: {
                allocation: 5,
                quota: 'mine-mineral',
                parts: { move: 4, carry: 2, work: 4},
                boost: { XUHO2: 4 },
                rules: { mine: { subtype: 'mineral' }, drop: { priority: 5 } }
            },
            mineral: {
                allocation: 5,
                quota: 'mine-mineral',
                parts: { move: 4, carry: 2, work: 8 },
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
                parts: {carry: 20, move: 10},
                rules: {
                    pickup: { subtype: false, local: true },
                    deliver: { subtype: 'spawn', local: true },
                    idle: { type: 'spawn' }
                },
                actions: { assignRoom: {} }
            },
            transfer: {
                quota: 'transfer',
                allocation: 2,
                max: 8,
                rules: { transfer: {}, deliver: { minerals: true, mineralTypes: [ STRUCTURE_STORAGE ], priority: 99 } },
                parts: {carry: 10, move: 10}
            },
            stockpile: {
                quota: 'deliver-stockpile',
                allocation: 1600,
                rules: {
                    pickup: { subtype: false, types: [ STRUCTURE_STORAGE ] },
                    deliver: { subtype: 'stockpile' }
                },
                parts: { carry: 20, move: 10 }
            },
            leveler: {
                quota: 'levelerhauler',
                max: 6,
                rules: {
                    pickup: { distanceWeight: 150, subtype: 'level' },
                    deliver: { types: [ STRUCTURE_STORAGE ], ignoreCreeps: true, ignoreDistance: true }
                },
                parts: { carry: 30, move: 15 }
            },
            long: {
                quota: 'pickup-remote',
                allocation: 800,
                max: 12,
                rules: {
                    pickup: { minerals: true, types: [ STRUCTURE_CONTAINER ], distanceWeight: 150, subtype: 'remote' },
                    deliver: { types: [ STRUCTURE_STORAGE ], ignoreCreeps: true, distanceWeight: 100, profile: true }
                },
                parts: { carry: 32, move: 16 }
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
                allocation: 10,
                parts: { work: 10, carry: 2, move: 6 },
                rules: { pickup: {}, upgrade: {} }
            },
            repair: {
                quota: 'repair',
                max: 10,
                //boostOptional: true,
                //boost: { XLH2O: 5 },
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
                allocation: 15,
                parts: { tough: 14, move: 16, attack: 15, heal: 3 },
                actions: { selfheal: {} }
            },
            ranged: {
                quota: 'idle-defend',
                max: 2,
                allocation: 1,
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
        rules: { defend: {}, keep: {}, idle: { type: 'keep' } }
    }
};