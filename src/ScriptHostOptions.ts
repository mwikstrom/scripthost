import { ScriptHostBridgeFactory } from "./ScriptHostBridge";

/**
 * Options that can be given to the {@link ScriptHost} constructor
 * @public
 */
export interface ScriptHostOptions {
    createBridge?: ScriptHostBridgeFactory;
}
