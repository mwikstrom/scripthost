import { GenericMessage, isGenericMessage } from "./GenericMessage";
import { isString } from "./internal/guard";

/**
 * The message that is sent to request script evaluation
 * @public
 */
export interface EvaluateScriptRequest extends GenericMessage<"eval"> {
    /** The script that shall be evaluated */
    script: string;

    /**
     * Optionally identifies the instance in which the script shall be evaluated
     * 
     * @remarks
     * This property shall be specified to use a specific `this` binding during script
     * evaluation.
     * 
     * When not specified, a temporary `this` binding is used for each evaluation.
     */
    instanceId?: string;

    /**
     * Optionally specifies that the script is idempotent, i.e. is not allowed to have side-effects.
     * @remarks
     * An idempotent script cannot write to variables or call functions that may have side-effects.
     */
    idempotent?: boolean;

    /**
     * Optionally specifies that variables that are accessed during script evaluation
     * shall be tracked.
     */
    track?: boolean;
}

/**
 * Determines whether something is a {@link EvaluateScriptRequest}
 * @public
 */
export function isEvaluateScriptRequest(thing: unknown): thing is EvaluateScriptRequest {
    return isGenericMessage(thing, "eval") && isString(thing["script"]);
}
