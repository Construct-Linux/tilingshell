import { Meta } from '../../gi/ext.js';
import SignalHandling from '../../utils/signalHandling.js';
import Settings from '../../settings/settings.js';
import { getWindows } from '../../utils/ui.js';
import ExtendedWindow from '../tilingsystem/extendedWindow.js';

export class RaiseTogetherManager {
    private readonly _signals: SignalHandling;
    private _raiseId: { [windowId: string]: number }; // map window id to 'raised' signal id

    constructor() {
        this._signals = new SignalHandling();
        this._raiseId = {};
    }

    public enable(): void {
        if (Settings.RAISE_TOGETHER) this._turnOn();

        // enable/disable based on user preferences
        this._signals.connect(Settings, Settings.KEY_RAISE_TOGETHER, () => {
            if (Settings.RAISE_TOGETHER) this._turnOn();
            else this._turnOff();
        });
    }

    public destroy() {
        this._signals.disconnect();
        this._raiseId = {};
    }

    public _turnOn() {
        getWindows().forEach((win) => this._connectRaisedSignal(win));

        this._signals.connect(
            global.display,
            'window-created',
            (_display: Meta.Display, window: Meta.Window) => {
                this._connectRaisedSignal(window);
            },
        );
    }

    private _turnOff() {
        this.destroy();
        this.enable();
    }

    private _connectRaisedSignal(window: Meta.Window) {
        const raisedId = this._signals.connect(window, "raised", () => {
            if (!(window as ExtendedWindow).assignedTile) return; // window not tiled

            this._onTiledWindowRaised(window);
        });
        this._raiseId[window.get_id()] = raisedId;
        this._signals.connect(window, 'unmanaged', () => {
            this._signals.disconnect(window);
            delete this._raiseId[window.get_id()];
        });
    }

    private _onTiledWindowRaised(tiledWindow: Meta.Window) {
        const workspace = tiledWindow.get_workspace();
        const monitorIndex = tiledWindow.get_monitor();
        getWindows(workspace).forEach(winSameWorkspace => {
            if (!(winSameWorkspace as ExtendedWindow).assignedTile) return; // window not tiled
            if (
                Settings.RAISE_TOGETHER_CURRENT_MONITOR_ONLY &&
                winSameWorkspace.get_monitor() !== monitorIndex
            )
                return;

            this._stopRaiseSignalHandling(winSameWorkspace);
            winSameWorkspace.raise();
            this._restartRaiseSignalHandling(winSameWorkspace);
        });

        this._stopRaiseSignalHandling(tiledWindow);
        tiledWindow.raise();
        this._restartRaiseSignalHandling(tiledWindow);
    }

    private _stopRaiseSignalHandling(window: Meta.Window) {
        const id = this._raiseId[window.get_id()];
        if (id) window.block_signal_handler(id);
    }

    private _restartRaiseSignalHandling(window: Meta.Window) {
        const id = this._raiseId[window.get_id()];
        if (id) window.unblock_signal_handler(id);
    }
}
