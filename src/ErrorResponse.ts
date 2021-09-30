import { GenericResponse, isGenericResponse } from "./GenericResponse";

/**
 * The response that is sent when an error occurred
 * @public
 */
export interface ErrorResponse extends GenericResponse<"error">{
    message: string;
}

/**
 * Determines whether something is an {@link ErrorResponse}
 * @public
 */
export function isErrorResponse(thing: unknown): thing is ErrorResponse {
    return isGenericResponse(thing, "error");
}
