import { GenericMessage, isGenericMessage } from "./GenericMessage";
import { isString } from "./internal/guard";

/**
 * Generic response
 * @public
 */
export interface GenericResponse<T extends string = string> extends GenericMessage<T> {
    /** Identifies the request message that this is a response to */
    inResponseTo: string;
}

/**
 * Determines whether something is a {@link GenericResponse}
 * @param thing - The thing to test
 * @param type - Optionally specifies the message type to test
 * @public
 */
export function isGenericResponse<T extends string>(thing: unknown, type?: string): thing is GenericResponse<T> {
    return (
        isGenericMessage(thing, type) &&
        isString(thing["inResponseTo"])
    );
}
