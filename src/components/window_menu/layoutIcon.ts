import Layout from '../../components/layout/Layout.js';
import LayoutWidget from '../../components/layout/LayoutWidget.js';
import Tile from '../../components/layout/Tile.js';
import SnapAssistTile from '../../components/snapassist/snapAssistTile.js';
import { registerGObjectClass } from '../../utils/gjs.js';
import { buildRectangle } from '../../utils/ui.js';
import { Clutter, Mtk } from '../../gi/ext.js';

export default class LayoutIcon extends LayoutWidget<SnapAssistTile> {
    static { registerGObjectClass(this) }
    
    constructor(
        parent: Clutter.Actor,
        importantTiles: Tile[],
        tiles: Tile[],
        innerGaps: Clutter.Margin,
        outerGaps: Clutter.Margin,
        width: number,
        height: number,
    ) {
        super({
            parent,
            layout: new Layout(tiles, ''),
            innerGaps: innerGaps.copy(),
            outerGaps: outerGaps.copy(),
            containerRect: buildRectangle(),
            styleClass: 'layout-icon button',
        });

        super.relayout({
            containerRect: buildRectangle({ x: 0, y: 0, width, height }),
        });
        this.set_size(width, height);
        this.set_x_expand(false);
        this.set_y_expand(false);

        importantTiles.forEach((t) => {
            const preview = this._previews.find(
                (snap) => snap.tile.x === t.x && snap.tile.y === t.y,
            );
            if (preview) preview.add_style_class_name('important');
        });
    }

    buildTile(
        parent: Clutter.Actor,
        rect: Mtk.Rectangle,
        gaps: Clutter.Margin,
        tile: Tile,
    ): SnapAssistTile {
        return new SnapAssistTile({ parent, rect, gaps, tile });
    }
}
