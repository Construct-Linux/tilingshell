import Layout from '../../components/layout/Layout.js';
import LayoutWidget from '../../components/layout/LayoutWidget.js';
import { registerGObjectClass } from '../../utils/gjs.js';
import { buildMarginOf, buildRectangle } from '../../utils/ui.js';
import { Clutter, Mtk } from '../../gi/ext.js';
import SnapAssistTileButton from '../snapassist/snapAssistTileButton.js';
import Tile from '../../components/layout/Tile.js';

export default class LayoutTileButtons extends LayoutWidget<SnapAssistTileButton> {
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
            containerRect: buildRectangle(),
            innerGaps: buildMarginOf(gapSize),
            outerGaps: buildMarginOf(gapSize),
            styleClass: 'window-menu-layout',
        });

        this.relayout({
            containerRect: buildRectangle({
                x: 0,
                y: 0,
                width,
                height,
            }),
        });
        this._fixFloatingPointErrors();
    }

    buildTile(
        parent: Clutter.Actor,
        rect: Mtk.Rectangle,
        gaps: Clutter.Margin,
        tile: Tile,
    ): SnapAssistTileButton {
        return new SnapAssistTileButton({ parent, rect, gaps, tile });
    }

    public get buttons(): SnapAssistTileButton[] {
        return this._previews;
    }

    private _fixFloatingPointErrors() {
        const xMap: Map<number, number> = new Map();
        const yMap: Map<number, number> = new Map();
        this._previews.forEach((prev) => {
            const tile = prev.tile;
            const newX = xMap.get(tile.x);
            if (!newX) xMap.set(tile.x, prev.rect.x);
            const newY = yMap.get(tile.y);
            if (!newY) yMap.set(tile.y, prev.rect.y);

            if (newX || newY) {
                prev.open(
                    buildRectangle({
                        x: newX ?? prev.rect.x,
                        y: newY ?? prev.rect.y,
                        width: prev.rect.width,
                        height: prev.rect.height,
                    }),
                    false
                );
            }
            xMap.set(
                tile.x + tile.width,
                xMap.get(tile.x + tile.width) ?? prev.rect.x + prev.rect.width,
            );
            yMap.set(
                tile.y + tile.height,
                yMap.get(tile.y + tile.height) ??
                    prev.rect.y + prev.rect.height,
            );
        });
    }
}
