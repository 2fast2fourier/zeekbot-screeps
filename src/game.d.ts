
interface ObjectMap<T> {
    [name: string]: T
}

interface ProcessList {
    [name: string]: (cluster: Cluster | null, args: any, allocation: any) => void
}

interface StructureList {
    spawn: StructureSpawn[]
    extension: StructureExtension[]
    rampart: StructureRampart[]
    controller: StructureController[]
    link: StructureLink[]
    storage: StructureStorage[]
    tower: StructureTower[]
    observer: StructureObserver[]
    powerBank: StructurePowerBank[]
    powerSpawn: StructurePowerSpawn[]
    extractor: StructureExtractor[]
    lab: StructureLab[]
    terminal: StructureTerminal[]
    nuker: StructureNuker[]
}

interface ProcessSystem {
    enqueueCreep: (priority: number, cluster: Cluster, creep: Creep) => void
    enqueueProcess: (priority: number, cluster: Cluster, process: string, args: any) => void
    enqueueFederalProcess: (priority: number, process: string, args: any) => void
    invokeProcess: (cluster: Cluster | null, process: string, args: any) => void
    process: () => void
}

interface MatrixTotals {
    attack: number
    heal: number
    ranged_attack: number
    work: number
    count: number
}

interface MatrixRoom {
    room: string
    armed: Creep[]
    hostiles: Creep[]
    damaged: Creep[]
    safemode: boolean
    keeper: boolean
    keeps: StructureKeeperLair[]
    target: Creep
    towers: StructureTower[]
    creeps: ObjectMap<Creep[]>
    underSiege: boolean
    total: MatrixTotals | ObjectMap<MatrixTotals>
    targetted: any
}

interface DefenseMatrix {
    rooms: ObjectMap<MatrixRoom>
}

interface ResourceData {
    total: number
    stored: number
    sources: Structure[],
    storage: StructureStorage[]
    terminal: StructureTerminal[]
    lab: StructureLab[]
    totals: {
        storage: number
        terminal: number
        lab: number
    }
}

interface Federation {
    matrix: DefenseMatrix
    queue: ProcessSystem
    structures: StructureList
    resources: ObjectMap<ResourceData>
    allocated: any
}

interface Cluster {
    id: string
    structures: StructureList
    state: any
    boost: any
    update: (name: string, value: any) => void
}

interface Room {
    cluster: Cluster
}

interface Creep {
    getCapacity: () => number
    getResource: (type: string) => number
    getResourceList: () => ObjectMap<number>
    getStored: () => number
}

interface Structure {
    getCapacity: () => number
    getResource: (type: string) => number
    getResourceList: () => ObjectMap<number>
    getStored: () => number
    hasTag: (tag: string) => boolean
}

interface RoomObject {
    inRangeToAll: (entities: RoomObject[], range: number) => boolean
}

interface Game {
    matrix: DefenseMatrix
    federation: Federation
    clusters: ObjectMap<Cluster>
    error: (error: Error) => void
    profile: (type: string, value: number) => void
    getObjects: any
}
