type ObjectWithSignals = {
    connect: (..._args: any[]) => number;
    disconnect: (_id: number) => void;
};

export default class SignalHandling {
    // one entry per connection: the same signal name is often connected on
    // several objects (or twice on one), so a name can't be the key
    private _connections: { obj: ObjectWithSignals; id: number }[];

    constructor() {
        this._connections = [];
    }

    public connect(
        obj: ObjectWithSignals,
        key: string,
        fun: (..._args: never[]) => void,
    ) {
        const id = obj.connect(key, fun);
        this._connections.push({ obj, id });

        return id;
    }

    /**
     * Disconnects every handler connected through this instance, or only the
     * ones connected on obj.
     */
    public disconnect(obj?: ObjectWithSignals): void {
        const keep: { obj: ObjectWithSignals; id: number }[] = [];
        for (const conn of this._connections) {
            if (obj && conn.obj !== obj) {
                keep.push(conn);
                continue;
            }
            conn.obj.disconnect(conn.id);
        }
        this._connections = keep;
    }
}
