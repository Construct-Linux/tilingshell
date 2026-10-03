import { registerGObjectClass } from '../../utils/gjs.js';
import { St, Clutter, Mtk } from '../../gi/ext.js';
import TilePreview from '../tilepreview/tilePreview.js';
import Tile from '../../components/layout/Tile.js';
import MasonryLayoutManager from './masonryLayoutManager.js';

const MASONRY_LAYOUT_SPACING = 32;

export default class SuggestionsTilePreview extends TilePreview {
    static { registerGObjectClass(this, {
        GTypeName: 'PopupTilePreview',
    })};

    private _container: St.BoxLayout;
    private _scrollView: St.ScrollView;

    constructor(params: {
        parent: Clutter.Actor;
        tile?: Tile;
        rect?: Mtk.Rectangle;
        gaps?: Clutter.Margin;
    }) {
        super(params);

        this._recolor();
        const styleChangedSignalID = St.ThemeContext.get_for_stage(
            global.get_stage(),
        ).connect('changed', () => {
            this._recolor();
        });
        this.connect('destroy', () =>
            St.ThemeContext.get_for_stage(global.get_stage()).disconnect(
                styleChangedSignalID,
            ),
        );

        this.reactive = true;
        this.layout_manager = new Clutter.BinLayout();

        this._container = new St.BoxLayout({
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style: `spacing: ${MASONRY_LAYOUT_SPACING}px;`,
            orientation: Clutter.Orientation.VERTICAL,
        });
        this._scrollView = new St.ScrollView({
            style_class: 'vfade',
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            hscrollbar_policy: St.PolicyType.NEVER,
            overlay_scrollbars: true,
            clip_to_allocation: true, // Ensure clipping
            x_expand: true,
            y_expand: true,
        });

        this._scrollView.add_child(this._container);
        this.add_child(this._scrollView);
    }

    public override set gaps(newGaps: Clutter.Margin) {
        super.gaps = newGaps;
        this.updateBorderRadius(
            this._gaps.top > 0,
            this._gaps.right > 0,
            this._gaps.bottom > 0,
            this._gaps.left > 0,
        );
    }

    _init() {
        super._init();

        this.add_style_class_name('selection-tile-preview');
    }

    _recolor() {
        this.set_style(null);

        const backgroundColor = this.get_theme_node()
            .get_background_color()
            .copy();
        // since an alpha value lower than 160 is not so much visible, enforce a minimum value of 160
        const newAlpha = Math.max(
            Math.min(backgroundColor.alpha + 35, 255),
            160,
        );
        // The final alpha value is divided by 255 since CSS needs a value from 0 to 1, but ClutterColor expresses alpha from 0 to 255
        this.set_style(`
            background-color: rgba(${backgroundColor.red}, ${backgroundColor.green}, ${backgroundColor.blue}, ${newAlpha / 255}) !important;
        `);
    }

    public addWindows(windows: Clutter.Actor[], maxRowHeight: number) {
        // little trick: we hide the container and add all the windows
        // then we queue_relayout and we can compute the sizes of the windows
        // to compute placements and scale them preserving aspect ratio
        this._container.hide();
        // empty out the container
        this._container.destroy_all_children();
        windows.forEach((actor) => this._container.add_child(actor));
        this._container.queue_relayout();
        const placements = MasonryLayoutManager.computePlacements(
            windows,
            this.innerWidth - 2 * MASONRY_LAYOUT_SPACING,
            this.innerHeight,
            maxRowHeight,
        );
        // we remove all the windows and show back the container
        this._container.remove_all_children();
        this._container.show();

        // add top space
        this._container.add_child(
            new St.Widget({ height: MASONRY_LAYOUT_SPACING }),
        );
        // add each row
        placements.forEach((row) => {
            const rowBox = new St.BoxLayout({
                x_align: Clutter.ActorAlign.CENTER,
                style: `spacing: ${MASONRY_LAYOUT_SPACING}px;`,
            });
            this._container.add_child(rowBox);
            row.forEach((pl) => {
                rowBox.add_child(pl.actor);
                pl.actor.set_height(pl.height);
                pl.actor.set_width(pl.width);
            });
        });
        // add bottom space
        this._container.add_child(
            new St.Widget({ height: MASONRY_LAYOUT_SPACING }),
        );
    }

    public removeAllWindows() {
        this._container.destroy_all_children();
    }
}
