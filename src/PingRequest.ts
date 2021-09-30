import { GenericMessage, isGenericMessage } from "./GenericMessage";

/**
 * The message that is sent to ping the other end of a bridge
 * @public
 */
export type PingRequest = GenericMessage<"ping">;

/**
 * Determines whether something is a {@link PingRequest}
 * @public
 */
export function isPingRequest(thing: unknown): thing is PingRequest {
    return isGenericMessage(thing, "ping");
}
