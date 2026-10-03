import { Clutter } from '../../gi/ext.js';
import { registerGObjectClass } from '../../utils/gjs.js';
import TilePreview from '../../components/tilepreview/tilePreview.js';

export default class TilePreviewWithWindow extends TilePreview {
    static { registerGObjectClass(this) }

    public override set gaps(gaps: Clutter.Margin) {
        this._gaps = gaps.copy();

        if (
            this._gaps.top === 0 &&
            this._gaps.bottom === 0 &&
            this._gaps.right === 0 &&
            this._gaps.left === 0
        )
            this.remove_style_class_name('custom-tile-preview');
        else this.add_style_class_name('custom-tile-preview');
    }

    public override _init() {
        super._init();
        this.remove_style_class_name('tile-preview');
    }
}
