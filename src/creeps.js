"use strict";

module.exports = {
    miner: {
        versions: {
            milli: {
                allocation: 6,
                critical: 900,
                parts: {work: 6, carry: 2, move: 4}
            },
            micro: {
                allocation: 6,
                critical: 750,
                disable: {
                    maxSpawn: 900
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
            // pico: {
            //     bootstrap: 1,
            //     quota: false,
            //     critical: 300,
            //     parts: {work: 2, carry: 1, move: 1},
            //     disable: {
            //         energy: 2000
            //     },
            //     additional: {
            //         unless: 5,
            //         spawn: 500
            //     }
            // }
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
                    deliver: { types: [ STRUCTURE_SPAWN, STRUCTURE_EXTENSION ], ignoreCreeps: true, local: true },
                    idle: { type: 'spawn' }
                }
            },
            picospawn: {
                bootstrap: 1,
                critical: 300,
                // disable: {
                //     maxSpawn: 600
                // },
                parts: {carry: 3, move: 3},
                rules: {
                    pickup: {},
                    deliver: { types: [ STRUCTURE_SPAWN, STRUCTURE_EXTENSION ], ignoreCreeps: true, local: true },
                    idle: { type: 'spawn' }
                }
            },
            micro: {
                ideal: 1,
                additionalPer: {
                    room: 1
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
            pickup: {},
            deliver: {}
        }
    },
    worker: {
        versions: {
            milli: {
                ideal: 1,
                additionalPer: {
                    room: 1
                },
                parts: {work: 6, carry: 2, move: 8}
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
            pico: {
                bootstrap: 1,
                // disable: {
                //     maxSpawn: 500
                // },
                parts: {work: 1, carry: 2, move: 2}
            },
            upgrade: {
                quota: {
                    jobType: 'upgrade',
                    allocation: 5,
                    ratio: 1
                },
                parts: {work: 5, carry: 2, move: 7},
                rules: { pickup: {}, upgrade: {} }
            }
        },
        rules: {
            pickup: {},
            build: {},
            repair: {},
            upgrade: { priority: 1 },
            idle: { type: 'worker' }
        }
    },
    observer: {
        versions: {
            pico: {
                ideal: 0,
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
    // fighter: {
    //     versions: {
    //         pico: {
    //             parts: {tough: 17, move: 16, attack: 15}
    //         },
    //     },
    //     quota: {
    //         jobType: 'defend',
    //         allocation: 15
    //     },
    //     rules: { attack: {}, defend: {} }
    // },
    healer: {
        versions: {
            pico: {
                ideal: 1,
                parts: {tough: 4, move: 8, heal: 4}
            },
        },
        // quota: {
        //     jobType: 'heal',
        //     allocation: 1,
        //     ratio: 1
        // },
        rules: { heal: {}, idle: { type: 'heal' } }
    }
};