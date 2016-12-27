"use strict";

module.exports = {
    miner: {
        versions: {
            milli: {
                allocation: 7,
                critical: 1400,
                parts: {move: 5, carry: 2, work: 7}
            },
            micro: {
                allocation: 6,
                critical: 750,
                disable: {
                    maxSpawn: 1400
                },
                parts: {work: 6, carry: 2, move: 1}
            },
            nano: {
                allocation: 4,
                critical: 550,
                disable: {
                    maxSpawn: 750
                },
                parts: {work: 4, carry: 2, move: 1}
            },
            pico: {
                bootstrap: 1,
                quota: false,
                critical: 300,
                parts: {work: 2, carry: 1, move: 1},
                disable: {
                    energy: 2000
                }
            }
        },
        quota: {
            jobType: 'mine',
            ratio: 1
        },
        rules: {
            mine: {},
            deliver: { maxRange: 2, ignoreCreeps: true, types: [ STRUCTURE_STORAGE, STRUCTURE_CONTAINER, STRUCTURE_TOWER ] },
            drop: { priority: 1 }
        },
        actions: { avoid: {} }
    },
    hauler: {
        versions: {
            spawn: {
                critical: 600,
                parts: {carry: 6, move: 6},
                additionalPer: {
                    room: 2
                },
                rules: {
                    pickup: {},
                    deliver: { types: [ STRUCTURE_SPAWN, STRUCTURE_EXTENSION ], ignoreCreeps: true, local: true },
                    idle: { type: 'spawn' }
                }
            },
            picospawn: {
                bootstrap: 1,
                critical: 300,
                parts: {carry: 3, move: 3},
                rules: {
                    pickup: {},
                    deliver: { types: [ STRUCTURE_SPAWN, STRUCTURE_EXTENSION ], ignoreCreeps: true },
                    idle: { type: 'spawn' }
                }
            },
            transfer: {
                quota: {
                    jobType: 'transfer',
                    allocation: 500,
                    max: 1
                },
                rules: { transfer: {}, deliver: { minerals: true, mineralTypes: [ STRUCTURE_STORAGE ], priority: 99 } },
                parts: {carry: 10, move: 10}
            },
            long: {
                ideal: 4,
                additionalPer: {
                    count: 4,
                    flagPrefix: 'Pickup'
                },
                rules: {
                    pickup: { minerals: true, types: [ STRUCTURE_CONTAINER ] },
                    deliver: { types: [ STRUCTURE_STORAGE ], ignoreCreeps: true }
                },
                parts: {carry: 20, move: 10}
            },
            leveler: {
                // additionalPer: {
                //     room: 2
                // },
                ideal: 4,
                requirements: {
                    energy: 250000
                },
                rules: {
                    pickup: { types: [ STRUCTURE_STORAGE ], min: 250000 },
                    deliver: { types: [ STRUCTURE_STORAGE ], ignoreCreeps: true }
                },
                parts: {carry: 10, move: 10}
            },
            micro: {
                additionalPer: {
                    room: 2
                },
                parts: {carry: 6, move: 6}
            },
            nano: {
                ideal: 2,
                disable: {
                    maxSpawn: 600
                },
                parts: {carry: 5, move: 5}
            },
            pico: {
                bootstrap: 1,
                parts: {carry: 2, move: 2}
            }
        },
        rules: {
            pickup: { minerals: true, types: [ STRUCTURE_STORAGE, STRUCTURE_CONTAINER ] },
            deliver: {}
        },
        actions: { avoid: {} }
    },
    observer: {
        versions: {
            pico: {
                quota: {
                    jobType: 'observe',
                    allocation: 1,
                    ratio: 1
                },
                parts: {tough: 1, move: 1}
            },
        },
        rules: { observe: {} }
    },
    worker: {
        versions: {
            builder: {
                quota: {
                    jobType: 'build',
                    allocation: 1,
                    max: 4
                },
                rules: {
                    pickup: {},
                    build: {},
                    repair: { priority: 99 }
                },
                parts: { work: 4, carry: 4, move: 8 }
            },
            upgrade: {
                quota: {
                    jobType: 'upgrade',
                    allocation: 5,
                    ratio: 1
                },
                parts: {work: 5, carry: 2, move: 7},
                rules: { pickup: {}, upgrade: {} }
            },
            repair: {
                quota: {
                    jobType: 'repair',
                    allocation: 1,
                    ratio: 1,
                    max: 10
                },
                rules: { pickup: {}, repair: {} },
                actions: { repair: {} },
                parts: { work: 5, carry: 5, move: 10 }
            }
        },
        rules: {
            pickup: {},
            build: {},
            repair: { priority: 5 },
            upgrade: { priority: 10 },
            idle: { type: 'worker' }
        },
        actions: { avoid: {} }
    },
    claimer: {
        versions: {
            // attack: {
            //     parts: {claim: 6, move: 6}
            // },
            pico: {
                parts: {claim: 2, move: 2}
            }
        },
        quota: {
            jobType: 'reserve',
            allocation: 2,
            ratio: 1
        },
        rules: { reserve: {} }
    },
    healer: {
        versions: {
            pico: {
                ideal: 1,
                parts: {tough: 4, move: 8, heal: 4}
            },
        },
        quota: {
            jobType: 'heal',
            allocation: 1,
            max: 1
        },
        rules: { heal: {}, idle: { type: 'heal' } }
    },
    fighter: {
        versions: {
            ranged: {
                additionalPer: {
                    count: 2,
                    flagPrefix: 'Defend'
                },
                parts: { tough: 10, move: 10, ranged_attack: 10 },
                rules: { defend: { ranged: true }, idle: { type: 'defend' } }
            },
            melee: {
                additionalPer: {
                    count: 1,
                    flagPrefix: 'Keep'
                },
                quota: {
                    jobType: 'keep',
                    allocation: 15
                },
                parts: { tough: 15, move: 16, attack: 15, heal: 2 },
                actions: { selfheal: {} }
            }
        },
        rules: { defend: {}, keep: {}, idle: { type: 'keep' } }
    }
};