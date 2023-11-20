import { EvaluateScriptRequest } from "scripthost-core";

/**
 * Options to the {@link ScriptHost.eval} method
 * @public
 */
export interface ScriptEvalOptions extends Pick<EvaluateScriptRequest, "idempotent" | "instanceId" | "vars"> {
    /**
     * The maximum time, in millseconds, to wait for a result
     * @remarks
     * The default value is specified by the {@link ScriptHostOptions.defaultTimeout} that was
     * passed to the {@link ScriptHost} constructor.
     * 
     * Specify zero or a negative value to wait forever.
     */
    timeout?: number;

    /**
     * Optionally specifies a callback that shall be invoked when the evaluated value is invalidated.
     */
    onInvalidated?: (this: void) => void;

    /**
     * Optionally specifies a context for the script evaluation. This context is exposed to script
     * functions that are called during evaluation.
     */
    context?: unknown;

    /**
     * Optionally specifies a registration function that shall register callbacks to be invoked when the observer of the
     * current script evaluation is no longer active.
     * 
     * @param callback - The callback to register
     * 
     * @returns true when the callback was registered, and otherwise false
     * 
     * @remarks
     * This function is optional and shall be undefined when the script evaluation is not being observed.
     */
    onObserverExit?: (callback: () => void) => boolean;
}
