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
            },
            // micro: {
            //     allocation: 6,
            //     critical: 750,
            //     disable: {
            //         maxSpawn: 1400
            //     },
            //     parts: {work: 6, carry: 2, move: 1}
            // },
            // nano: {
            //     allocation: 4,
            //     critical: 550,
            //     disable: {
            //         maxSpawn: 750
            //     },
            //     parts: {work: 4, carry: 2, move: 1}
            // },
            // pico: {
            //     bootstrap: 1,
            //     quota: false,
            //     critical: 300,
            //     parts: {work: 2, carry: 1, move: 1},
            //     disable: {
            //         energy: 2000
            //     }
            // }
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
            // picospawn: {
            //     bootstrap: 1,
            //     critical: 300,
            //     parts: {carry: 3, move: 3},
            //     rules: {
            //         pickup: {},
            //         deliver: { types: [ STRUCTURE_SPAWN, STRUCTURE_EXTENSION ], ignoreCreeps: true, subtype: 'spawn' },
            //         idle: { type: 'spawn' }
            //     }
            // },
            transfer: {
                quota: 'transfer',
                allocation: 1,
                max: 4,
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
                max: 10,
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
                allocation: 1000,
                max: 4,
                parts: { carry: 20, move: 10 },
                rules: {
                    pickup: { subtype: 'mineral', minerals: true, types: [ STRUCTURE_CONTAINER ] },
                    deliver: { subtype: false }
                }
            },
            // nano: {
            //     ideal: 2,
            //     disable: {
            //         maxSpawn: 600
            //     },
            //     parts: { carry: 5, move: 5 }
            // },
            // pico: {
            //     bootstrap: 1,
            //     parts: { carry: 2, move: 2 }
            // }
        },
        actions: { avoid: {} }
    },
    observer: {
        versions: {
            soaker: {
                quota: 'observe-soak',
                max: 5,
                parts: { tough: 40, move: 10 },
                memory: { ignoreHealth: true },
                rules: { observe: { subtype: 'soak' } }
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
                boost: { XLH2O: 4 },
                rules: {
                    pickup: {},
                    build: {},
                    repair: { priority: 99 }
                },
                parts: { work: 4, carry: 6, move: 10 }
            },
            upgrade: {
                quota: 'upgrade',
                allocation: 10,
                parts: { work: 10, carry: 2, move: 6 },
                rules: { pickup: {}, upgrade: {} }
            },
            boostrepair: {
                quota: 'repair',
                max: 10,
                boost: { XLH2O: 2 },
                rules: { pickup: {}, repair: {} },
                actions: { avoid: {}, repair: {} },
                parts: { work: 2, carry: 6, move: 4 }
            },
            repair: {
                quota: 'repair',
                max: 10,
                rules: { pickup: {}, repair: {} },
                actions: { avoid: {}, repair: {} },
                parts: { work: 5, carry: 10, move: 8 }
            }
        },
        rules: {
            pickup: {},
            build: {},
            repair: { priority: 5 },
            upgrade: { priority: 10 },
            idle: { type: 'worker' }
        },
        actions: { avoid: {}, energy: {} }
    },
    claimer: {
        versions: {
            attack: {
                parts: { claim: 5, move: 5 },
                quota: 'reserve-downgrade',
                allocation: 5,
                max: 5,
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
            boost: {
                quota: 'heal',
                max: 2,
                boost: { XLHO2: 4 },
                parts: { tough: 4, move: 8, heal: 4 },
                actions: { boost: {} }
            },
            pico: {
                quota: 'heal',
                max: 2,
                parts: { tough: 4, move: 8, heal: 4 }
            },
        },
        rules: { heal: {}, idle: { type: 'heal' } }
    },
    fighter: {
        versions: {
            boostmelee: {
                critical: true,
                quota: 'keep',
                allocation: 10,
                boost: { XUH2O: 5 },
                parts: { tough: 24, move: 16, attack: 5, heal: 3 },
                actions: { boost: {}, selfheal: {} }
            },
            melee: {
                critical: true,
                quota: 'keep',
                allocation: 10,
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
                quota: 'idle-staging',
                max: 3,
                allocation: 1,
                parts: { tough: 17, move: 16, attack: 15 },
                rules: { attack: {}, defend: {}, idle: { type: 'staging' } }
            }
        },
        rules: { defend: {}, keep: {}, idle: { type: 'keep' } }
    }
};