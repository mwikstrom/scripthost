import { ScriptEvalOptions } from "./ScriptEvalOptions";
import { ScriptValue } from "./ScriptValue";

/**
 * Options to the {@link ScriptHost.observe} method
 * @public
 */
export interface ScriptObserveOptions extends Omit<ScriptEvalOptions, "idempotent" | "onInvalidated"> {
    onNext: (this: void, value: ScriptValue) => void;
    onError?: (this: void, error: unknown) => void;
}
