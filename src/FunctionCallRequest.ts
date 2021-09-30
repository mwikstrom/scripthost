import { GenericMessage, isGenericMessage } from "./GenericMessage";
import { isString } from "./internal/guard";
import { ScriptValue } from "./ScriptValue";

/**
 * The message that is sent from the underlying sandbox to invoke a function
 * exposed by the script host.
 * @public
 */
export interface FunctionCallRequest extends GenericMessage<"call"> {
    /** The function that shall be called */
    key: string;

    /** Function call arguments */
    args: ScriptValue[];

    /** Specifies whether the function is called from an idempotent script */
    idempotent: boolean;

    /** Unique identifier of the message that caused script evaluation */
    correlationId: string;
}

/**
 * Determines whether something is a {@link FunctionCallRequest}
 * @public
 */
export function isFunctionCallRequest(thing: unknown): thing is FunctionCallRequest {
    return isGenericMessage(thing, "call") && isString(thing["key"]);
}
