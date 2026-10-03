import { registerGObjectClass } from '../../utils/gjs.js';
import { Clutter, Mtk, St } from '../../gi/ext.js';
import LayoutWidget from '../layout/LayoutWidget.js';
import Tile from '../layout/Tile.js';
import SnapAssistTile from './snapAssistTile.js';
import Layout from '../../components/layout/Layout.js';
import { buildRectangle } from '../../utils/ui.js';

export default class SnapAssistLayout extends LayoutWidget<SnapAssistTile> {
    static { registerGObjectClass(this) }
    
    constructor(
        parent: St.Widget,
        layout: Layout,
        innerGaps: Clutter.Margin,
        outerGaps: Clutter.Margin,
        width: number,
        height: number,
    ) {
        super({
            containerRect: buildRectangle({ x: 0, y: 0, width, height }),
            parent,
            layout,
            innerGaps,
            outerGaps,
        });
        this.set_size(width, height);
        super.relayout();
    }

    buildTile(
        parent: Clutter.Actor,
        rect: Mtk.Rectangle,
        gaps: Clutter.Margin,
        tile: Tile,
    ): SnapAssistTile {
        return new SnapAssistTile({ parent, rect, gaps, tile });
    }

    public getTileBelow(cursorPos: {
        x: number;
        y: number;
    }): SnapAssistTile | undefined {
        const [x, y] = this.get_transformed_position();

        for (let i = 0; i < this._previews.length; i++) {
            const preview = this._previews[i];
            const pos = { x: x + preview.rect.x, y: y + preview.rect.y };

            const isHovering =
                cursorPos.x >= pos.x &&
                cursorPos.x <= pos.x + preview.rect.width &&
                cursorPos.y >= pos.y &&
                cursorPos.y <= pos.y + preview.rect.height;
            if (isHovering) return preview;
        }

        return undefined;
    }
}
