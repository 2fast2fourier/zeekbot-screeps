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
                loadout: partList({work: 6, carry: 2, move: 4})
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
                loadout: partList({work: 6, carry: 2, move: 1})
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
                loadout: partList({work: 4, carry: 1, move: 1})
            },
            pico: {
                bootstrap: 1,
                critical: 300,
                loadout: partList({work: 2, carry: 1, move: 1}),
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
                loadout: partList({work: 6, carry: 2, move: 2}),
                requirements: {
                    flag: 'Harvest'
                },
                behaviors: {
                    mining: { flag: 'Harvest' },
                    deliver: { maxRange: 1, ignoreClass: ['miner', 'extractor', 'tender'], excludeRemote: true },
                    drop: { priority: 0.75 }
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
                critical: 400,
                loadout: partList({carry: 4, move: 4}),
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
                loadout: partList({carry: 5, move: 5})
            },
            pico: {
                bootstrap: 2,
                critical: 200,
                disable: {
                    spawnCapacity: 500
                },
                loadout: partList({carry: 2, move: 2})
            },
            remote: {
                ideal: 2,
                loadout: partList({carry: 10, move: 5}),
                remote: true,
                requirements: {
                    flag: 'Collect'
                },
                behaviors: {
                    pickup: { flag: 'Collect', containerTypes: [ STRUCTURE_CONTAINER, STRUCTURE_STORAGE ] },
                    deliver: { flag: 'Dropoff', ignoreCreeps: true, containerTypes: [ STRUCTURE_STORAGE ], maxStorage: 25000 }
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
                loadout: partList({work: 4, carry: 2, move: 6})
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
                loadout: partList({work: 2, carry: 2, move: 4})
            },
            pico: {
                bootstrap: 1,
                additional: {
                    count: 1,
                    buildHits: 1000
                },
                loadout: partList({work: 1, carry: 2, move: 2})
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
                loadout: partList({work: 4, carry: 2, move: 4}),
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
                loadout: partList({work: 2, carry: 2, move: 4}),
                behaviors: { pickup: {}, repair: {}, emergencydeliver: {} }
            },
            upgrade: {
                ideal: 1,
                additional: {
                    count: 1,
                    energy: 5000
                },
                loadout: partList({work: 8, carry: 2, move: 3}),
                behaviors: { pickup: {}, upgrade: {}, emergencydeliver: {} }
            },
            nanoupgrade: {
                ideal: 3,
                disable: {
                    spawnCapacity: 850
                },
                loadout: partList({work: 6, carry: 2, move: 2}),
                behaviors: { pickup: {}, upgrade: {}, emergencydeliver: {} }
            },
            picoupgrade: {
                ideal: 2,
                disable: {
                    spawnCapacity: 600
                },
                loadout: partList({work: 4, carry: 2, move: 1}),
                behaviors: { pickup: {}, upgrade: {}, emergencydeliver: {} }
            },
            remoteupgrade: {
                ideal: 2,
                requirements: {
                    flag: 'Upgrade'
                },
                loadout: partList({work: 6, carry: 4, move: 3}),
                behaviors: { pickup: {}, upgrade: { flag: 'Upgrade' }, emergencydeliver: {} },
                remote: true
            },
            remoterepair: {
                ideal: 1,
                requirements: {
                    flag: 'Repair'
                },
                loadout: partList({work: 2, carry: 2, move: 4}),
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
                    extractor: true
                },
                loadout: partList({work: 10, carry: 2, move: 6})
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
                loadout: partList({carry: 6, move: 6}),
                requirements: {
                    extractor: true
                }
            },
            energy: {
                ideal: 1,
                loadout: partList({carry: 4, move: 4}),
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
    fighter: {
        versions: {
            nano: {
                ideal: 2,
                requirements: {
                    flag: 'Assault'
                },
                loadout: partList({tough: 9, move: 12, attack: 15}),
                behaviors: { attack: { flag: 'Assault' } },
                remote: true
            },
            pico: {
                ideal: 2,
                requirements: {
                    flag: 'Attack'
                },
                loadout: partList({tough: 8, move: 8, attack: 8}),
                remote: true
            }
        },
        behaviors: { attack: { flag: 'Attack' }, defend: { flag: 'Base' } }
    },
    healer: {
        versions: {
            pico: {
                ideal: 1,
                requirements: {
                    flag: 'Heal'
                },
                loadout: partList({tough: 8, move: 6, heal: 4}),
                remote: true
            }
        },
        behaviors: { attack: { flag: 'Attack' }, defend: { flag: 'Base' } }
    },
    claimer: {
        versions: {
            pico: {
                ideal: 2,
                requirements: {
                    flag: 'Reserve'
                },
                loadout: [ CLAIM, MOVE ],
                remote: true
            }
        },
        behaviors: { claim: { flag: 'Claim' }, reserve: { flag: 'Reserve' } }
    }
};