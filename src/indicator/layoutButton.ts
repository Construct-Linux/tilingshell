import { St, Clutter, Mtk } from '../gi/ext.js';
import LayoutWidget from '../components/layout/LayoutWidget.js';
import SnapAssistTile from '../components/snapassist/snapAssistTile.js';
import Layout from '../components/layout/Layout.js';
import Tile from '../components/layout/Tile.js';
import { buildMarginOf, buildRectangle } from '../utils/ui.js';
import { registerGObjectClass } from '../utils/gjs.js';

class LayoutButtonWidget extends LayoutWidget<SnapAssistTile> {
    static { registerGObjectClass(this) }

    constructor(
        parent: Clutter.Actor,
        layout: Layout,
        gapSize: number,
        height: number,
        width: number,
    ) {
        super({
            parent,
            layout,
            containerRect: buildRectangle({ x: 0, y: 0, width, height }),
            innerGaps: buildMarginOf(gapSize),
            outerGaps: new Clutter.Margin(),
        });
        this.relayout();
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

export default class LayoutButton extends St.Button {
    static { registerGObjectClass(this) }

    constructor(
        parent: Clutter.Actor,
        layout: Layout,
        gapSize: number,
        height: number,
        width: number,
    ) {
        super({
            styleClass: 'layout-button button',
            xExpand: false,
            yExpand: false,
        });

        parent.add_child(this);

        this.child = new St.Widget(); // the child is just a container
        new LayoutButtonWidget(
            this.child,
            layout,
            gapSize,
            height,
            width,
        );
    }
}
