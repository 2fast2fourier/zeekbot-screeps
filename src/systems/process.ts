const Worker = require('../worker');
import Processes from '../process';

interface ProcessEntry {
    priority: number;
    creep?: Creep;
    process?: string;
    args?: any,
    cluster: Cluster | null;
    critical: boolean;
    persist: boolean;
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
            critical: creep.memory.critical,
            persist: false
        });
    }
    
    enqueueProcess(priority: number, cluster: Cluster, process: string, persist: boolean, args: any){
        this.queue.push({
            priority,
            process,
            cluster,
            critical: false,
            persist,
            args
        });
    }
    
    enqueueFederalProcess(priority: number, process: string, persist: boolean, args: any){
        this.queue.push({
            priority,
            process,
            cluster: null,
            critical: false,
            persist,
            args
        });
    }

    hydratePersistedTasks(){
        //TODO hydrate persisted stuff
    }

    process(){
        this.hydratePersistedTasks();
        const softLimit = Game.cpu.bucket > 9000 ? Game.cpu.limit + 100 : Game.cpu.limit;
        let skipped = 0;
        const sortedQueue = _.sortBy(this.queue, 'priority');
        for(let entry of sortedQueue){
            if(!entry.critical && Game.cpu.getUsed() > softLimit){
                skipped++;
                if(entry.persist){
                    //TODO persist stuff here
                }
                continue;
            }
            try{
                if(entry.creep){
                    Worker.work(entry.cluster, entry.creep);
                }else if(entry.process){
                    let process = Processes[entry.process];
                    if(process){
                        process(entry.cluster, entry.args, Game.federation.allocated);
                    }else{
                        console.log('Invalid process: ' + entry.process);
                        Game.notify('Invalid process: ' + entry.process);
                    }
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