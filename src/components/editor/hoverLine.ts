import { registerGObjectClass } from '../../utils/gjs.js';
import { St, Clutter } from '../../gi/ext.js';
import EditableTilePreview from './editableTilePreview.js';

export default class HoverLine extends St.Widget {
    static { registerGObjectClass(this) }
    
    private readonly _keymap: Clutter.Keymap;
    private readonly _keymapStateId: number;
    private readonly _size: number;

    private _hoveredTile: EditableTilePreview | null;

    constructor(parent: Clutter.Actor) {
        super({ styleClass: 'hover-line' });
        parent.add_child(this);

        this._hoveredTile = null;

        this._size = 16;

        this.hide();

        // Ctrl flips the split direction while the pointer stands still;
        // the keymap emits state-changed on every modifier change
        this._keymap = global.stage
            .get_context()
            .get_backend()
            .get_default_seat()
            .get_keymap();
        this._keymapStateId = this._keymap.connect('state-changed', () =>
            this._handleModifierChange(),
        );

        this.connect('destroy', this._onDestroy.bind(this));
    }

    public handleTileDestroy(tile: EditableTilePreview) {
        if (this._hoveredTile === tile) {
            this._hoveredTile = null;
            this.hide();
        }
    }

    public handleMouseMove(tile: EditableTilePreview, x: number, y: number) {
        this._hoveredTile = tile;
        if (!tile.hover) {
            this.hide();
            return;
        }

        const modifier = global.get_pointer()[2];

        // split horizontally when CTRL is NOT pressed, split vertically instead
        const splitHorizontally =
            (modifier & Clutter.ModifierType.CONTROL_MASK) === 0;
        this._drawLine(splitHorizontally, x, y);
    }

    private _handleModifierChange() {
        if (!this._hoveredTile?.hover) return;

        const [x, y, modifier] = global.get_pointer();
        // split horizontally when CTRL is NOT pressed, split vertically instead
        const splitHorizontally =
            (modifier & Clutter.ModifierType.CONTROL_MASK) === 0;

        this._drawLine(
            splitHorizontally,
            x - (this.get_parent()?.x || 0),
            y - (this.get_parent()?.y || 0),
        );
    }

    private _drawLine(splitHorizontally: boolean, x: number, y: number) {
        if (!this._hoveredTile) return;

        if (splitHorizontally) {
            const newX = x - this._size / 2;
            if (
                newX < this._hoveredTile.x ||
                newX + this._size >
                    this._hoveredTile.x + this._hoveredTile.width
            )
                return;

            this.set_size(this._size, this._hoveredTile.height);
            this.set_position(newX, this._hoveredTile.y);
        } else {
            const newY = y - this._size / 2;
            if (
                newY < this._hoveredTile.y ||
                newY + this._size >
                    this._hoveredTile.y + this._hoveredTile.height
            )
                return;

            this.set_size(this._hoveredTile.width, this._size);
            this.set_position(this._hoveredTile.x, newY);
        }

        this.show();
    }

    private _onDestroy() {
        this._keymap.disconnect(this._keymapStateId);
        this._hoveredTile = null;
    }
}
