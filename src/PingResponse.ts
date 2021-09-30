import { GenericResponse, isGenericResponse } from "./GenericResponse";

/**
 * The message that is sent to in response to a ping
 * @public
 */
export type PingResponse = GenericResponse<"pong">;

/**
 * Determines whether something is a {@link PingResponse}
 * @public
 */
export function isPingResponse(thing: unknown): thing is PingResponse {
    return isGenericResponse(thing, "pong");
}
