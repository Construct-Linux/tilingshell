import { GObject, Meta, St, Clutter, Shell, Gio, GLib } from '../../gi/ext';
import SignalHandling from '../../utils/signalHandling';
import { registerGObjectClass } from '../../utils/gjs';
import Settings from '../../settings/settings';
import { buildRectangle } from '../../utils/ui';

Gio._promisify(Shell.Screenshot, 'composite_to_stream');

const DEFAULT_BORDER_RADIUS = 11;
const SMART_BORDER_RADIUS_FIRST_FRAME_DELAY = 240;

interface WindowWithCachedRadius extends Meta.Window {
    __ts_cached_radius: [number, number, number, number] | undefined;
}

export default class WindowBorder extends St.Widget {
    static { registerGObjectClass(this) }

    private readonly _signals: SignalHandling;

    private _window: Meta.Window;
    private _bindings: GObject.Binding[];
    private _borderRadiusValue: [number, number, number, number];
    private _timeout: GLib.Source | undefined;
    private _delayedSmartBorderRadius: boolean;
    private _borderWidth: number;

    constructor(win: Meta.Window) {
        super({
            style_class: 'window-border'
        });
        this._signals = new SignalHandling();
        this._bindings = [];
        this._borderWidth = 1;
        this._window = win;
        this._delayedSmartBorderRadius = false;
        const smartRadius = Settings.ENABLE_SMART_WINDOW_BORDER_RADIUS;
        this._borderRadiusValue = [
            DEFAULT_BORDER_RADIUS,
            DEFAULT_BORDER_RADIUS,
            smartRadius ? 0 : DEFAULT_BORDER_RADIUS,
            smartRadius ? 0 : DEFAULT_BORDER_RADIUS,
        ]; // default value

        this.close();
        global.windowGroup.add_child(this);
        this.trackWindow(win, true);
        this.connect('destroy', () => {
            this._bindings.forEach((b) => b.unbind());
            this._bindings = [];
            this._signals.disconnect();
            if (this._timeout) clearTimeout(this._timeout);
            this._timeout = undefined;
        });
    }

    public trackWindow(win: Meta.Window, force: boolean = false) {
        if (!force && this._window === win) return;

        this._bindings.forEach((b) => b.unbind());
        this._bindings = [];
        this._signals.disconnect();
        this._delayedSmartBorderRadius = false;
        this._window = win;
        this.close();
        const winActor =
            this._window.get_compositor_private() as Meta.WindowActor;

        // scale and translate like the window actor
        this._bindings = [
            'scale-x',
            'scale-y',
            'translation_x',
            'translation_y',
        ].map((prop) =>
            winActor.bind_property(
                prop,
                this,
                prop,
                GObject.BindingFlags.DEFAULT, // if winActor changes, this will change
            ),
        );

        const cachedRadius = (this._window as WindowWithCachedRadius)
            .__ts_cached_radius;
        if (Settings.ENABLE_SMART_WINDOW_BORDER_RADIUS && cachedRadius) {
            this._borderRadiusValue[St.Corner.TOPLEFT] =
                cachedRadius[St.Corner.TOPLEFT];
            this._borderRadiusValue[St.Corner.TOPRIGHT] =
                cachedRadius[St.Corner.TOPRIGHT];
            this._borderRadiusValue[St.Corner.BOTTOMLEFT] =
                cachedRadius[St.Corner.BOTTOMLEFT];
            this._borderRadiusValue[St.Corner.BOTTOMRIGHT] =
                cachedRadius[St.Corner.BOTTOMRIGHT];
        }
        this.updateStyle();
        this._updateGeometry();

        const isMaximized =
            this._window.maximizedVertically &&
            this._window.maximizedHorizontally;
        if (
            this._window.is_fullscreen() ||
            isMaximized ||
            this._window.minimized ||
            !winActor.visible
        )
            this.close();
        else this.open();

        // sit right above the window: its transients and every window
        // stacked over it cover the border instead of the border covering
        // them
        this._stackAboveWindow(winActor);
        this._signals.connect(global.display, 'restacked', () =>
            this._stackAboveWindow(winActor),
        );

        this._signals.connect(this._window, 'position-changed', () =>
            this._onWindowGeometryChanged(winActor),
        );
        this._signals.connect(this._window, 'size-changed', () =>
            this._onWindowGeometryChanged(winActor),
        );

        // first-frame fires once, for a window that has not been drawn yet:
        // a window measured before keeps its radius cached on it
        if (Settings.ENABLE_SMART_WINDOW_BORDER_RADIUS && !cachedRadius) {
            this._signals.connect(winActor, 'first-frame', () => {
                this._signals.disconnect(winActor);
                if (
                    this._window.maximizedHorizontally ||
                    this._window.maximizedVertically ||
                    this._window.is_fullscreen()
                ) {
                    this._delayedSmartBorderRadius = true;
                    return;
                }
                this._runComputeBorderRadiusTimeout(winActor);
            });
        }
    }

    private _stackAboveWindow(winActor: Meta.WindowActor) {
        if (winActor.get_parent() === global.windowGroup)
            global.windowGroup.set_child_above_sibling(this, winActor);
        else global.windowGroup.set_child_above_sibling(this, null);
    }

    private _updateGeometry() {
        const rect = this._window.get_frame_rect();
        this.set_position(
            rect.x - this._borderWidth,
            rect.y - this._borderWidth,
        );
        this.set_size(
            rect.width + (2 * this._borderWidth),
            rect.height + (2 * this._borderWidth),
        );
    }

    private _onWindowGeometryChanged(winActor: Meta.WindowActor) {
        if (
            this._window.maximizedVertically ||
            this._window.maximizedHorizontally ||
            this._window.minimized ||
            this._window.is_fullscreen()
        ) {
            this.remove_all_transitions();
            this.close();
            return;
        }

        if (
            this._delayedSmartBorderRadius &&
            Settings.ENABLE_SMART_WINDOW_BORDER_RADIUS
        ) {
            this._delayedSmartBorderRadius = false;
            this._runComputeBorderRadiusTimeout(winActor);
        }

        this._updateGeometry();
        this.open();
    }

    private _runComputeBorderRadiusTimeout(winActor: Meta.WindowActor) {
        if (this._timeout) clearTimeout(this._timeout);
        this._timeout = undefined;

        this._timeout = setTimeout(() => {
            this._computeBorderRadius(winActor).then(() => this.updateStyle());
            if (this._timeout) clearTimeout(this._timeout);
            this._timeout = undefined;
        }, SMART_BORDER_RADIUS_FIRST_FRAME_DELAY);
    }

    private async _computeBorderRadius(winActor: Meta.WindowActor) {
        // we are only interested into analyze the leftmost pixels (i.e. the whole left border)
        const width = 3;
        const height = winActor.metaWindow.get_frame_rect().height;
        if (height <= 0) return;
        const content = winActor.paint_to_content(
            buildRectangle({
                x: winActor.metaWindow.get_frame_rect().x,
                y: winActor.metaWindow.get_frame_rect().y,
                height,
                width,
            }),
        );
        if (!content) return;

        /* for debugging purposes
        const elem = new St.Widget({
            x: 100,
            y: 100,
            width,
            height,
            content,
            name: 'elem',
        });
        global.windowGroup
            .get_children()
            .find((el) => el.get_name() === 'elem')
            ?.destroy();
        global.windowGroup.add_child(elem);*/
        // @ts-expect-error "content has get_texture() method"
        const texture = content.get_texture();
        const stream = Gio.MemoryOutputStream.new_resizable();
        const x = 0;
        const y = 0;
        const pixbuf = await Shell.Screenshot.composite_to_stream(
            texture,
            x,
            y,
            width,
            height,
            1,
            null,
            0,
            0,
            1,
            stream,
        );
        // @ts-expect-error "pixbuf has get_pixels() method"
        const pixels = pixbuf.get_pixels();

        const alphaThreshold = 240; // 255 would be the best value, however, some windows may still have a bit of transparency
        // iterate pixels from top to bottom
        for (let i = 0; i < height; i++) {
            if (pixels[i * width * 4 + 3] > alphaThreshold) {
                this._borderRadiusValue[St.Corner.TOPLEFT] = i;
                this._borderRadiusValue[St.Corner.TOPRIGHT] =
                    this._borderRadiusValue[St.Corner.TOPLEFT];
                break;
            }
        }
        // iterate pixels from bottom to top
        for (let i = height - 1; i >= height - this._borderRadiusValue[St.Corner.TOPLEFT] - 2; i--) {
            if (pixels[i * width * 4 + 3] > alphaThreshold) {
                this._borderRadiusValue[St.Corner.BOTTOMLEFT] = height - i - 1;
                this._borderRadiusValue[St.Corner.BOTTOMRIGHT] =
                    this._borderRadiusValue[St.Corner.BOTTOMLEFT];
                break;
            }
        }
        stream.close(null);

        const cached_radius: [number, number, number, number] = [
            DEFAULT_BORDER_RADIUS,
            DEFAULT_BORDER_RADIUS,
            0,
            0,
        ];
        cached_radius[St.Corner.TOPLEFT] =
            this._borderRadiusValue[St.Corner.TOPLEFT];
        cached_radius[St.Corner.TOPRIGHT] =
            this._borderRadiusValue[St.Corner.TOPRIGHT];
        cached_radius[St.Corner.BOTTOMLEFT] =
            this._borderRadiusValue[St.Corner.BOTTOMLEFT];
        cached_radius[St.Corner.BOTTOMRIGHT] =
            this._borderRadiusValue[St.Corner.BOTTOMRIGHT];
        (this._window as WindowWithCachedRadius).__ts_cached_radius =
            cached_radius;
    }

    public updateStyle(): void {
        const borderWidth = Settings.WINDOW_BORDER_WIDTH;
        const borderColor = Settings.WINDOW_USE_CUSTOM_BORDER_COLOR
            ? Settings.WINDOW_BORDER_COLOR
            : '-st-accent-color';
        const radius = this._borderRadiusValue.map((val) =>
            val === 0 ? val : val + borderWidth,
        );

        this.set_style(
            `border-width: ${borderWidth}px; border-color: ${borderColor}; border-radius: ${radius[St.Corner.TOPLEFT]}px ${radius[St.Corner.TOPRIGHT]}px ${radius[St.Corner.BOTTOMRIGHT]}px ${radius[St.Corner.BOTTOMLEFT]}px;`,
        );
        if (this._borderWidth !== borderWidth) {
            this._borderWidth = borderWidth;
            this._updateGeometry();
        }
    }

    public open() {
        if (this.visible) return;

        this.show();
        this.ease({
            opacity: 255,
            duration: 200,
            mode: Clutter.AnimationMode.EASE,
            delay: 130,
        });
    }

    public close() {
        this.set_opacity(0);
        this.hide();
    }
}
