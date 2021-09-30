import { GenericResponse, isGenericResponse } from "./GenericResponse";

/**
 * The message that is sent when the underlying sandbox is ready
 * @public
 */
export interface InitializeResponse extends GenericResponse<"ready"> {
    /** Keys of exposed functions */
    funcs: Set<string>;
}

/**
 * Determines whether something is a {@link InitializeResponse}
 * @public
 */
export function isInitializeResponse(thing: unknown): thing is InitializeResponse {
    return isGenericResponse(thing, "ready");
}
