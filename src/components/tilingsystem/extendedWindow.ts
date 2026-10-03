import Tile from '../../components/layout/Tile.js';
import { Mtk, Meta } from '../../gi/ext.js';

interface ExtendedWindow extends Meta.Window {
    originalSize: Mtk.Rectangle | undefined;
    assignedTile: Tile | undefined;
    tileBeforeMaximize?: Tile;
}

export default ExtendedWindow;
