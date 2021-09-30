import { GenericResponse, isGenericResponse } from "./GenericResponse";
import { ScriptValue } from "./ScriptValue";

/**
 * The response that is sent back to the sandbox after a successful function call
 * @public
 */
export interface FunctionCallResponse extends GenericResponse<"return">{
    /** The return value */
    result: ScriptValue;
}

/**
 * Determines whether something is a {@link FunctionCallResponse}
 * @public
 */
export function isFunctionCallResponse(thing: unknown): thing is FunctionCallResponse {
    return isGenericResponse(thing, "return");
}