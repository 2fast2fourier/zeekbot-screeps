"use strict";

module.exports = {
    miner: {
        versions: {
            milli: {
                ideal: 2,
                critical: 900,
                parts: {work: 6, carry: 2, move: 4}
            },
            micro: {
                ideal: 2,
                critical: 750,
                disable: {
                    spawnCapacity: 900
                },
                additional: {
                    unless: 1,
                    spawn: 900
                },
                parts: {work: 6, carry: 2, move: 1}
            },
            nano: {
                ideal: 4,
                critical: 550,
                disable: {
                    spawnCapacity: 750
                },
                parts: {work: 4, carry: 2, move: 1}
            },
            pico: {
                bootstrap: 1,
                critical: 300,
                parts: {work: 2, carry: 1, move: 1},
                disable: {
                    energy: 2000
                },
                additional: {
                    unless: 5,
                    spawn: 500
                }
            }
        },
        rules: {
            mine: {},
            deliver: { maxRange: 2, ignoreCreeps: true },
            drop: { priority: 1 }
        }
    },
    hauler: {
        versions: {
            spawn: {
                ideal: 2,
                critical: 600,
                parts: {carry: 6, move: 6},
                rules: {
                    pickup: {},
                    deliver: { types: [ STRUCTURE_SPAWN, STRUCTURE_EXTENSION ], ignoreCreeps: true }
                }
            },
            picospawn: {
                ideal: 2,
                critical: 300,
                disable: {
                    spawnCapacity: 600
                },
                parts: {carry: 3, move: 3},
                rules: {
                    pickup: {},
                    deliver: { types: [ STRUCTURE_SPAWN, STRUCTURE_EXTENSION ], ignoreCreeps: true }
                }
            },
            nano: {
                ideal: 2,
                additional: {
                    count: 2,
                    upgradeDistance: 20
                },
                parts: {carry: 5, move: 5}
            },
            pico: {
                bootstrap: 2,
                disable: {
                    spawnCapacity: 500
                },
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
            micro: {
                ideal: 1,
                additional: {
                    count: 1,
                    buildHits: 1000
                },
                parts: {work: 4, carry: 2, move: 6}
            },
            nano: {
                ideal: 2,
                disable: {
                    spawnCapacity: 800
                },
                additional: {
                    count: 2,
                    buildHits: 1000
                },
                parts: {work: 2, carry: 2, move: 4}
            },
            pico: {
                bootstrap: 1,
                disable: {
                    spawnCapacity: 500
                },
                additional: {
                    unless: 1,
                    spawn: 500
                },
                parts: {work: 1, carry: 2, move: 2}
            }
        },
        rules: {
            pickup: {},
            build: {},
            repair: {},
            upgrade: {}
        }
    }
};