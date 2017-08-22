
import EmptyTerminals from './emptyTerminals';
import FillRequests from './fillRequests';
import Labs from './labs';
import LevelTerminals from './levelTerminals';
import LinkTransfer from './linkTransfer';
import TerminalEnergy from './terminalEnergy';
import Walls from './walls';

const Processes: ProcessList = {
    emptyTerminals: EmptyTerminals,
    fillRequests: FillRequests,
    labs: Labs,
    levelTerminals: LevelTerminals,
    linkTransfer: LinkTransfer,
    terminalEnergy: TerminalEnergy,
    walls: Walls
}

export default Processes;