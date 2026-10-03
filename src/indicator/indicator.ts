import { St, Clutter, Shell, Gio } from '../gi/ext.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import Settings from '../settings/settings.js';
import Layout from '../components/layout/Layout.js';
import Tile from '../components/layout/Tile.js';
import LayoutEditor from '../components/editor/layoutEditor.js';
import DefaultMenu from './defaultMenu.js';
import GlobalState from '../utils/globalState.js';
import EditingMenu from './editingMenu.js';
import EditorDialog from '../components/editor/editorDialog.js';
import CurrentMenu from './currentMenu.js';
import { registerGObjectClass } from '../utils/gjs.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

enum IndicatorState {
    DEFAULT = 1,
    CREATE_NEW,
    EDITING_LAYOUT,
}

export default class Indicator extends PanelMenu.Button {
    static { registerGObjectClass(this, {
        Signals: {
            'open-preferences': {
                param_types: [],
            },
        },
        GTypeName: 'Indicator',
    }) }

    private _layoutEditor: LayoutEditor | null;
    private _editorDialog: EditorDialog | null;
    private _currentMenu: CurrentMenu | null;
    private _state: IndicatorState;
    private _path: string;
    private _keyPressEvent: number | null;

    constructor(path: string, uuid: string) {
        super(0.5, 'Tiling Shell Indicator', false);
        Main.panel.addToStatusArea(uuid, this, 1, 'right');

        // Bind the "show-indicator" setting to the "visible" property
        Settings.bind(
            Settings.KEY_SHOW_INDICATOR,
            this,
            'visible',
            Gio.SettingsBindFlags.GET,
        );

        const icon = new St.Icon({
            gicon: Gio.icon_new_for_string(
                `${path}/icons/indicator-symbolic.svg`,
            ),
            styleClass: 'system-status-icon indicator-icon',
        });

        this.add_child(icon);
        this._layoutEditor = null;
        this._editorDialog = null;
        this._currentMenu = null;
        this._state = IndicatorState.DEFAULT;
        this._keyPressEvent = null;
        this._path = path;

        this.connect('destroy', this._onDestroy.bind(this));
    }

    public get path(): string {
        return this._path;
    }

    public enable() {
        (this.menu as PopupMenu.PopupMenu).removeAll();
        this._currentMenu = new DefaultMenu(this, this._openPreferences.bind(this));
    }

    public selectLayoutOnClick(monitorIndex: number, layoutToSelectId: string) {
        GlobalState.get().setSelectedLayoutOfMonitor(
            layoutToSelectId,
            monitorIndex,
        );
        this.menu.toggle();
    }

    public newLayoutOnClick(showLegendOnly: boolean) {
        this.menu.close(true);

        const newLayout = new Layout(
            [
                new Tile({ x: 0, y: 0, width: 0.3, height: 1, groups: [1] }),
                new Tile({ x: 0.3, y: 0, width: 0.7, height: 1, groups: [1] }),
            ],
            `${Shell.Global.get().get_current_time()}`,
        );

        if (this._layoutEditor) {
            this._layoutEditor.layout = newLayout;
        } else {
            this._layoutEditor = new LayoutEditor(
                newLayout,
                Main.layoutManager.monitors[Main.layoutManager.primaryIndex],
            );
        }
        this._setState(IndicatorState.CREATE_NEW);
        if (showLegendOnly) this.openMenu(true);
    }

    public openMenu(showLegend: boolean) {
        if (this._editorDialog) return;

        this._editorDialog = new EditorDialog({
            onNewLayout: () => {
                this.newLayoutOnClick(false);
            },
            onDeleteLayout: (ind: number, lay: Layout) => {
                GlobalState.get().deleteLayout(lay);

                if (
                    this._layoutEditor &&
                    this._layoutEditor.layout.id === lay.id
                )
                    this.cancelLayoutOnClick();
            },
            onSelectLayout: (ind: number, lay: Layout) => {
                const layCopy = new Layout(
                    lay.tiles.map(
                        (t) =>
                            new Tile({
                                x: t.x,
                                y: t.y,
                                width: t.width,
                                height: t.height,
                                groups: [...t.groups],
                            }),
                    ),
                    lay.id,
                );

                if (this._layoutEditor) {
                    this._layoutEditor.layout = layCopy;
                } else {
                    this._layoutEditor = new LayoutEditor(
                        layCopy,
                        Main.layoutManager.monitors[
                            Main.layoutManager.primaryIndex
                        ],
                    );
                }

                this._setState(IndicatorState.EDITING_LAYOUT);
            },
            onClose: () => {
                this._editorDialog?.destroy();
                this._editorDialog = null;
            },
            onReorderLayout: (fromIndex: number, toIndex: number) => {
                GlobalState.get().swapLayouts(fromIndex, toIndex);
            },
            path: this._path,
            legend: showLegend,
        });
        this._editorDialog.open();
    }

    public openLayoutEditor() {
        if (Main.sessionMode.isLocked) return;
        this.openMenu(false);
    }

    // the extension stays enabled on the lock screen, where the panel keeps
    // extension indicators visible (ref gnome-shell js/ui/panel.js
    // _hideIndicators only hides the built-in roles). A layout being edited
    // survives the lock: its editor follows global.windowGroup's
    // visibility, which the lock screen hides
    public setLocked(locked: boolean) {
        if (locked) {
            this.menu.close();
            this._editorDialog?.close();
            this._editorDialog = null;
            this.container.hide();
        } else {
            this.container.show();
        }
    }

    public saveLayoutOnClick() {
        if (
            this._layoutEditor === null ||
            this._state === IndicatorState.DEFAULT
        )
            return;
        const newLayout = this._layoutEditor.layout;

        if (this._state === IndicatorState.CREATE_NEW)
            GlobalState.get().addLayout(newLayout);
        else GlobalState.get().editLayout(newLayout);

        this.menu.toggle();

        this._layoutEditor.destroy();
        this._layoutEditor = null;

        this._setState(IndicatorState.DEFAULT);
    }

    public cancelLayoutOnClick() {
        if (
            this._layoutEditor === null ||
            this._state === IndicatorState.DEFAULT
        )
            return;

        this.menu.toggle();

        this._layoutEditor.destroy();
        this._layoutEditor = null;

        this._setState(IndicatorState.DEFAULT);
    }

    private _openPreferences() {
        this.emit('open-preferences');
    };

    private _setState(newState: IndicatorState) {
        if (this._state === newState) return;
        this._state = newState;
        this._currentMenu?.destroy();
        switch (newState) {
            case IndicatorState.DEFAULT:
                this._currentMenu = new DefaultMenu(this, this._openPreferences.bind(this));
                if (!Settings.SHOW_INDICATOR) this.hide();
                if (this._keyPressEvent) {
                    global.stage.disconnect(this._keyPressEvent);
                    this._keyPressEvent = null;
                }
                break;
            case IndicatorState.CREATE_NEW:
            case IndicatorState.EDITING_LAYOUT:
                if (this._keyPressEvent)
                    global.stage.disconnect(this._keyPressEvent);
                this._keyPressEvent = global.stage.connect_after(
                    'key-press-event',
                    (_, event) => {
                        const symbol = event.get_key_symbol();
                        if (symbol === Clutter.KEY_Escape)
                            this.cancelLayoutOnClick();

                        return Clutter.EVENT_PROPAGATE;
                    },
                );
                this._currentMenu = new EditingMenu(this);
                this.show();
                break;
        }
    }

    private _onDestroy() {
        this._editorDialog?.destroy();
        this._editorDialog = null;
        this._layoutEditor?.destroy();
        this._layoutEditor = null;
        this._currentMenu?.destroy();
        this._currentMenu = null;
        (this.menu as PopupMenu.PopupMenu).removeAll();
    }
}
