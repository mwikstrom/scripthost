import { EvaluateScriptRequest } from "scripthost-core";

/**
 * Options to the {@link ScriptHost.eval} method
 * @public
 */
export interface ScriptEvalOptions extends Pick<EvaluateScriptRequest, "idempotent" | "instanceId"> {
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
}
