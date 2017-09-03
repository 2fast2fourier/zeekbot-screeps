
import Autobuilder from './autobuilder';
import EmptyTerminals from './emptyTerminals';
import FillRequests from './fillRequests';
import Labs from './labs';
import LevelTerminals from './levelTerminals';
import LinkTransfer from './linkTransfer';
import MiscStats from './miscstats';
import TerminalEnergy from './terminalEnergy';
import Walls from './walls';

const Processes: ProcessList = {
    autobuilder: Autobuilder,
    emptyTerminals: EmptyTerminals,
    fillRequests: FillRequests,
    miscstats: MiscStats,
    labs: Labs,
    levelTerminals: LevelTerminals,
    linkTransfer: LinkTransfer,
    terminalEnergy: TerminalEnergy,
    walls: Walls
}

export default Processes;