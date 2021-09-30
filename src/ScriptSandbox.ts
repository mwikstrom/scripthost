import { ScriptValue } from "./ScriptValue";

/**
 * A sandbox in which scripts are run
 * @public
 */
export interface ScriptSandbox {
    /** Disposes the underlying sandbox */
    dispose(): void;

    /**
     * Sends a message to the sandbox
     * @param message - The message to be sent
     */
    post(message: ScriptValue): void;

    /**
     * Listens to messages from the sandbox
     * @param handler - The callback to be invoked whenever a message is received
     * @returns A callback that shall be called to stop receiving messages
     */
    listen(handler: (this: void, message: ScriptValue) => void): (this: void) => void;
}

/**
 * Alias for a function that construct {@link ScriptSandbox} instances
 * @public
 */
export type ScriptSandboxFactory = (this: void) => ScriptSandbox;
