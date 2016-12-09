"use strict";

function partList(args){
    // var types = {work: WORK, carry: CARRY, move: MOVE, attack: ATTACK, tough: TOUGH};
    // var prices = {work: 100, carry: 50, move: 50, attack: 80, tough: 10};
    var parts = [];
    _.forEach(args, (count, name)=>{
        for(var iy=0;iy<count;iy++){
            parts.push(name);
        }
    });
    return parts;
}

module.exports = {
    miner: {
        versions: {
            micro: {
                ideal: 2,
                critical: 900,
                parts: {work: 6, carry: 2, move: 4}
            },
            nano: {
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
            pano: {
                bootstrap: 1,
                critical: 500,
                disable: {
                    spawnCapacity: 750
                },
                additional: {
                    unless: 3,
                    spawn: 750
                },
                parts: {work: 4, carry: 1, move: 1}
            },
            pico: {
                bootstrap: 1,
                critical: 300,
                parts: {work: 2, carry: 1, move: 1},
                disable: {
                    energy: 2000
                },
                additional: {
                    unless: 1,
                    spawn: 500
                },
                behaviors: {
                    mining: {},
                    deliver: { maxRange: 2, ignoreCreeps: true },
                    drop: { priority: 10 },
                    emergencydeliver: { }
                }
            },
            remote: {
                ideal: 2,
                parts: {move: 4, work: 6, carry: 2},
                requirements: {
                    flag: 'Harvest', energy: 60000, flagClear: 10
                },
                behaviors: {
                    mining: { flag: 'Harvest', maxRange: 5, approachFlag: true },
                    deliver: { maxRange: 1, ignoreCreeps: true },
                    drop: { priority: 1 }
                },
                remote: true
            }
        },
        behaviors: {
            mining: {},
            deliver: { maxRange: 2, ignoreCreeps: true },
            drop: { priority: 10 }
        }
    },
    hauler: {
        versions: {
            spawn: {
                ideal: 2,
                critical: 600,
                parts: {carry: 6, move: 6},
                behaviors: {
                    pickup: { containerTypes: [ STRUCTURE_CONTAINER, STRUCTURE_STORAGE, STRUCTURE_LINK ] },
                    deliver: { containerTypes: [ STRUCTURE_EXTENSION, STRUCTURE_SPAWN ], ignoreCreeps: true }
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
                critical: 200,
                disable: {
                    spawnCapacity: 500
                },
                parts: {carry: 2, move: 2}
            },
            remote: {
                ideal: 4,
                parts: {move: 5, carry: 10},
                remote: true,
                requirements: {
                    flag: 'Collect', energy: 60000, flagClear: 20
                },
                disable: {
                    energy: 500000
                },
                behaviors: {
                    pickup: { flag: 'Collect', containerTypes: [ STRUCTURE_CONTAINER, STRUCTURE_STORAGE ] },
                    deliver: { flag: 'Dropoff', ignoreCreeps: true, containerTypes: [ STRUCTURE_STORAGE ], maxStorage: 500000 }
                },
            }
        },
        behaviors: {
            pickup: { containerTypes: [ STRUCTURE_CONTAINER, STRUCTURE_STORAGE ] },
            deliver: {
                ignoreClass: [ 'hauler', 'miner', 'extractor', 'tender' ],
                containerTypes: [ STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_SPAWN ]
            }
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
                ideal: 1,
                disable: {
                    spawnCapacity: 800
                },
                additional: {
                    count: 1,
                    buildHits: 1000
                },
                parts: {work: 2, carry: 2, move: 4}
            },
            pico: {
                bootstrap: 1,
                additional: {
                    count: 1,
                    buildHits: 1000
                },
                parts: {work: 1, carry: 2, move: 2}
            },
            repair: {
                ideal: 1,
                requirements: {
                    repairHits: 10000 
                },
                additional: {
                    count: 1,
                    repairHits: 20000
                },
                parts: {work: 4, carry: 2, move: 4},
                behaviors: { pickup: {}, repair: {}, emergencydeliver: {} }
            },
            picorepair: {
                ideal: 1,
                disable: {
                    spawnCapacity: 700
                },
                additional: {
                    count: 1,
                    repairHits: 10000
                },
                parts: {work: 2, carry: 2, move: 4},
                behaviors: { pickup: {}, repair: {}, emergencydeliver: {} }
            },
            upgrade: {
                ideal: 1,
                additional: {
                    count: 1,
                    energy: 25000
                },
                parts: {work: 8, carry: 2, move: 3},
                behaviors: { pickup: {}, upgrade: {}, emergencydeliver: {} }
            },
            nanoupgrade: {
                ideal: 3,
                disable: {
                    spawnCapacity: 850
                },
                parts: {work: 6, carry: 2, move: 2},
                behaviors: { pickup: {}, upgrade: {}, emergencydeliver: {} }
            },
            picoupgrade: {
                ideal: 2,
                disable: {
                    spawnCapacity: 600
                },
                parts: {work: 4, carry: 2, move: 1},
                behaviors: { pickup: {}, upgrade: {}, emergencydeliver: {} }
            },
            remote: {
                ideal: 1,
                requirements: {
                    flag: 'Work'
                },
                behaviors: {
                    pickup: { flag: 'Work', energy: 60000, flagClear: 20 },
                    emergencydeliver: {},
                    build: {},
                    repair: { priority: 2 }
                },
                remote: true,
                parts: {move: 6, work: 4, carry: 2}
            },
            remoteupgrade: {
                ideal: 2,
                requirements: {
                    flag: 'Upgrade', energy: 60000, flagClear: 20
                },
                parts: {work: 6, carry: 4, move: 3},
                behaviors: { pickup: {}, upgrade: { flag: 'Upgrade' }, emergencydeliver: {} },
                remote: true
            },
            remoterepair: {
                ideal: 1,
                requirements: {
                    flag: 'Repair', energy: 60000, flagClear: 20
                },
                parts: {move: 4, work: 2, carry: 2},
                behaviors: { pickup: {}, repair: { flag: 'Repair' }, emergencydeliver: {} },
                remote: true
            }
        },
        behaviors: {
            pickup: {},
            emergencydeliver: {},
            build: { priority: 1, ideal: 2 },
            repair: { priority: 2 },
            upgrade: { priority: 3 }
        }
    },
    extractor: {
        versions: {
            micro: {
                ideal: 1,
                requirements: {
                    extractor: true,
                    mineralAmount: 1
                },
                parts: {work: 10, carry: 2, move: 6}
            }
        },
        behaviors: {
            extract: {},
            deliver: { maxRange: 3, ignoreCreeps: true, containerTypes: [ STRUCTURE_STORAGE, STRUCTURE_CONTAINER ] },
            drop: { priority: 10 }
        }
    },
    tender: {
        versions: {
            nano: {
                ideal: 1,
                parts: {carry: 6, move: 6},
                requirements: {
                    extractor: true,
                    mineralAmount: 1
                }
            },
            energy: {
                ideal: 1,
                parts: {carry: 4, move: 4},
                requirements: {
                    extractor: true
                },
                disable: {
                    terminalEnergy: 20000
                },
                behaviors: {
                    pickup: { containerTypes: [ STRUCTURE_STORAGE ] },
                    deliver: { containerTypes: [ STRUCTURE_TERMINAL ], ignoreCreeps: true, maxStorage: 20000 },
                    emergencydeliver: {}
                }
            }
        },
        behaviors: {
            pickup: { mineral: true, containerTypes: [ STRUCTURE_CONTAINER ] },
            deliver: { containerTypes: [ STRUCTURE_TERMINAL, STRUCTURE_STORAGE ], ignoreCreeps: true }
        }
    },
    keepminer: {
        versions: {
            a1: {
                ideal: 1,
                parts: {move: 4, work: 7, carry: 2},
                requirements: { flag: 'Keep-1-Mine', energy: 60000, flagClear: 10 },
                flag: 'Keep-1-Mine'
            },
            a2: {
                ideal: 1,
                parts: {move: 4, work: 7, carry: 2},
                requirements: { flag: 'Keep-2-Mine', energy: 60000, flagClear: 10 },
                flag: 'Keep-2-Mine'
            }
        },
        behaviors: {
            mining: { flag: true, maxRange: 10, approachFlag: true },
            deliver: { maxRange: 1, ignoreCreeps: true },
            drop: { priority: 1 }
        },
        remote: true
    },
    keepfighter: {
        versions: {
            a1: {
                ideal: 2,
                parts: {tough: 17, move: 16, attack: 15},
                requirements: { flag: 'Keep-1' },
                flag: 'Keep-1'
            },
            a2: {
                ideal: 2,
                parts: {tough: 17, move: 16, attack: 15},
                requirements: { flag: 'Keep-2' },
                flag: 'Keep-2'
            }
        },
        behaviors: { attack: { flag: true, maxRange: 10 } },
        remote: true
    },
    fighter: {
        versions: {
            ranged: {
                ideal: 1,
                requirements: {
                    flag: 'Assault'
                },
                parts: {tough: 10, move: 10, ranged_attack: 10},
                behaviors: { attack: { flag: 'Assault', maxRange: 10, ranged: true } },
                remote: true
            },
            nano: {
                ideal: 1,
                requirements: {
                    flag: 'Assault'
                },
                parts: {tough: 17, move: 16, attack: 15},
                behaviors: { attack: { flag: 'Assault', maxRange: 10 } },
                remote: true
            }
        },
        behaviors: { attack: { flag: 'Attack' }, defend: { flag: 'Base' } }
    },
    healer: {
        versions: {
            pico: {
                ideal: 2,
                requirements: {
                    flag: 'Heal',
                    energy: 25000
                },
                parts: {tough: 4, move: 8, heal: 4},
                remote: true
            }
        },
        behaviors: { heal: { flag: 'Heal' } }
    },
    claimer: {
        versions: {
            pico: {
                ideal: 1,
                requirements: {
                    flag: 'Reserve'
                },
                parts: {move: 2, claim: 2},
                remote: true
            }
        },
        behaviors: { claim: { flag: 'Claim' }, reserve: { flag: 'Reserve' } }
    }
};