const Worker = require('../worker');
import Processes from '../process';

interface ProcessEntry {
    priority: number;
    creep?: Creep;
    process?: string;
    args?: any,
    cluster: Cluster | null;
    critical: boolean;
}

export default class Process implements ProcessSystem {
    queue: ProcessEntry[];

    constructor(){
        this.queue = [];
    }

    enqueueCreep(priority: number, cluster: Cluster, creep: Creep){
        this.queue.push({
            priority,
            creep,
            cluster,
            critical: creep.memory.critical
        });
    }
    
    enqueueProcess(priority: number, cluster: Cluster, process: string, args: any){
        this.queue.push({
            priority,
            process,
            cluster,
            critical: false,
            args
        });
    }
    
    enqueueFederalProcess(priority: number, process: string, args: any){
        this.queue.push({
            priority,
            process,
            cluster: null,
            critical: false,
            args
        });
    }

    invokeProcess(cluster: Cluster | null, process: string, args: any){
        let processFn = Processes[process];
        if(process){
            processFn(cluster, args, Game.federation.allocated);
        }else{
            console.log('Invalid process: ' + process);
            Game.notify('Invalid process: ' + process);
        }
    }

    hydratePersistedTasks(){
        //TODO hydrate persisted stuff
    }

    process(){
        this.hydratePersistedTasks();
        const softLimit = Game.cpu.bucket > 9000 ? Game.cpu.tickLimit - 200 : Game.cpu.limit;
        let skipped = 0;
        const sortedQueue = _.sortBy(this.queue, 'priority');
        for(let entry of sortedQueue){
            let cpu = Game.cpu.getUsed();
            if(cpu > softLimit){
                if(!entry.critical || cpu > Game.cpu.tickLimit - 100){
                    skipped++;
                    continue;
                }
            }
            try{
                if(entry.creep){
                    Worker.work(entry.cluster, entry.creep);
                }else if(entry.process){
                    this.invokeProcess(entry.cluster, entry.process, entry.args);
                }
            }catch(e){
                Game.error(e);
                if(entry.creep){
                    entry.creep.memory.errorCount = (entry.creep.memory.errorCount || 0) + 1;
                    if(entry.creep.memory.errorCount > 5){
                        Game.notify('Error count exceeded: ' + entry.creep.name
                                  + ' - ' + entry.creep.memory.cluster
                                  + ' - ' + entry.creep.memory.errorCount);
                        entry.creep.suicide();
                    }
                }
            }
        }
        if(skipped > 0){
            console.log('Skipped', skipped, 'process steps!', Game.cpu.getUsed(), 'of', softLimit);
        }
        Game.profile('skipped', skipped);
    }
}