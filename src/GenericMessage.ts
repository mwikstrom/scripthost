import { isObject, isString } from "./internal/guard";
import { ScriptObject } from "./ScriptValue";

/**
 * Generic message
 * @public
 */
export interface GenericMessage<T extends string = string> extends Partial<ScriptObject> {
    /** Message discriminator */
    type: T;

    /** Unique message identifier */
    messageId: string;
}

/**
 * Determines whether something is a {@link GenericMessage}
 * @param thing - The thing to test
 * @param type - Optionally specifies the message type to test
 * @public
 */
export function isGenericMessage<T extends string>(thing: unknown, type?: string): thing is GenericMessage<T> {
    if (!isObject(thing)) {
        return false;
    }

    if (!isString(thing["messageId"])) {
        return false;
    }

    if (isString(type)) {
        return thing["type"] === type;
    } else {
        return isString(thing["type"]);
    }
}
