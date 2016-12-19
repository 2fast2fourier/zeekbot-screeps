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
        }
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
                    deliver: { types: [ STRUCTURE_SPAWN, STRUCTURE_EXTENSION ], ignoreCreeps: true },
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
            long: {
                ideal: 2,
                additionalPer: {
                    count: 4,
                    flagPrefix: 'Pickup'
                },
                rules: {
                    pickup: { minerals: true, types: [ STRUCTURE_CONTAINER ] },
                    deliver: { types: [ STRUCTURE_STORAGE ], ignoreCreeps: true }
                },
                parts: {carry: 10, move: 10}
            },
            leveler: {
                additionalPer: {
                    room: 1
                },
                rules: {
                    pickup: { types: [ STRUCTURE_STORAGE ], min: 100000 },
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
        }
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
            milli: {
                additionalPer: {
                    room: 2,
                    flagPrefix: 'Repair'
                },
                parts: {work: 4, carry: 4, move: 8}
            },
            micro: {
                ideal: 2,
                disable: {
                    maxSpawn: 1400
                },
                parts: {work: 4, carry: 2, move: 6}
            },
            nano: {
                ideal: 2,
                disable: {
                    maxSpawn: 800
                },
                parts: {work: 2, carry: 2, move: 4}
            },
            // pico: {
            //     bootstrap: 1,
            //     parts: {work: 1, carry: 2, move: 2}
            // },
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
                    allocation: 100,
                    ratio: 0.5,
                    max: 10
                },
                rules: {
                    pickup: {},
                    repair: {},
                },
                parts: {work: 2, carry: 2, move: 4}
            }
        },
        rules: {
            pickup: {},
            build: {},
            repair: { priority: 2 },
            upgrade: { priority: 10 },
            idle: { type: 'worker' }
        }
    },
    claimer: {
        versions: {
            pico: {
                parts: {claim: 2, move: 2}
            },
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
            max: 2
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
                parts: {tough: 10, move: 10, ranged_attack: 10},
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
                parts: {tough: 17, move: 16, attack: 15}
            }
        },
        rules: { defend: {}, keep: {}, idle: { type: 'keep' } }
    }
};