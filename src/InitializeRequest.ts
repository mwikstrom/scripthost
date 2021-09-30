import { GenericMessage, isGenericMessage } from "./GenericMessage";

/**
 * The message that is sent to initialize the underlying sandbox
 * @public
 */
export interface InitializeRequest extends GenericMessage<"init"> {
    /** Keys of exposed functions */
    funcs: Set<string>;
}

/**
 * Determines whether something is a {@link InitializeRequest}
 * @public
 */
export function isInitializeRequest(thing: unknown): thing is InitializeRequest {
    return isGenericMessage(thing, "init");
}
