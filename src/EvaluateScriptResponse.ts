import { GenericResponse, isGenericResponse } from "./GenericResponse";
import { ScriptObject, ScriptValue } from "./ScriptValue";

/**
 * The response that is sent back after successful script evaluation
 * @public
 */
export interface EvaluateScriptResponse extends GenericResponse<"result">{
    /** The result value */
    result: ScriptValue;

    /** Optionally includes the global variables that were accessed during script evaluation */
    vars?: Map<string, TrackedVariable>;
}

/**
 * A tracked variable
 * @public
 */
export interface TrackedVariable extends Partial<ScriptObject> {
    /**
     * The version of the global scope when the variable was first read
     */
    read?: number;

    /**
     * The version of the global scope after the variable was last written
     */
    write?: number;
}

/**
 * Determines whether something is a {@link EvaluateScriptResponse}
 * @public
 */
export function isEvaluateScriptResponse(thing: unknown): thing is EvaluateScriptResponse {
    return isGenericResponse(thing, "result");
}