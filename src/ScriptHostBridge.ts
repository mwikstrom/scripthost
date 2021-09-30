import { ScriptValue } from "./ScriptValue";

/**
 * Bridge to an underlying script sandbox
 * @public
 */
export interface ScriptHostBridge {
    /** Disposes the underlying sandbox */
    dispose(): void;

    /**
     * Sends a message to the underlying sandbox
     * @param message - The message to be sent
     */
    post(message: ScriptValue): void;

    /**
     * Listens to messages from the underlying sandbox
     * @param handler - The callback to be invoked whenever a message is received
     * @returns A callback that shall be called to stop receiving messages
     */
    listen(handler: (this: void, message: ScriptValue) => void): (this: void) => void;
}

/**
 * Alias for a function that construct {@link ScriptHostBridge} instances
 * @public
 */
export type ScriptHostBridgeFactory = (this: void) => ScriptHostBridge;
