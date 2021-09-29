import { ScriptHostBridge, ScriptHostBridgeFactory } from "./ScriptHostBridge";
import { ScriptHostOptions } from "./ScriptHostOptions";

/**
 * The host in which scripts are evaluated
 * @public
 */
export class ScriptHost {
    #bridge: ScriptHostBridge;

    public static createDefaultBridge(): ScriptHostBridge {
        if (!DEFAULT_BRIDGE_FACTORY) {
            throw new Error("There is no default script host bridge factory");
        }

        return DEFAULT_BRIDGE_FACTORY();
    }

    public static setupDefaultBridge(factory: ScriptHostBridgeFactory): void {
        DEFAULT_BRIDGE_FACTORY = factory;
    }

    constructor(options: ScriptHostOptions = {}) {
        const { createBridge = ScriptHost.createDefaultBridge } = options;
        this.#bridge = createBridge();
    }

    public dispose(): void {
        this.#bridge.dispose();
    }
}

let DEFAULT_BRIDGE_FACTORY: ScriptHostBridgeFactory | null = null;
