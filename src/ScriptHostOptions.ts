import { ScriptValue } from "scripthost-core";

/**
 * Options that can be given to the {@link ScriptHost} constructor
 * @public
 */
export interface ScriptHostOptions {
    /** Optionally specifies functions that shall be exposed to scripts */
    expose?: ExposedFunctions;

    /**
     * The default interval, in milliseconds, that is allowed to elapse after sending
     * a request before the request is considered to have timed out.
     * @remarks
     * The default value is `30000`. Specify zero or a negative value to disable timeout.
     */
    defaultTimeout?: number;

    /**
     * The interval, in milliseconds, that is allowed to elapse when the sandbox is initialized.
     * @remarks
     * The default value is `defaultTimeout`.
     */
    initTimeout?: number;

    /** 
     * Optionally specifies the interval, in milliseconds, that the host shall ping 
     * the underlying sandbox to determine whether it is unresponsive
     * @remarks
     * The default value is `2500`. Specify zero or a negative value to disable pinging.
     */
    pingInterval?: number;

    /**
     * Optionally specifies the interval, in milliseconds, that must elapse since the last 
     * message was received from the underlying sandbox to consider is unresponsive
     * @remarks
     * The default is twice the value of `pingInterval`.
     */
    unresponsiveInterval?: number;

    /**
     * Optional message identifier prefix
     */
    messageIdPrefix?: string;

    /**
     * Specifies whether global variables shall be read-only
     */
    readOnlyGlobals?: boolean;
}

/**
 * Functions exposed to scripts
 * @public
 */
export type ExposedFunctions = Partial<Readonly<Record<string, ScriptFunction>>>;

/**
 * A function that can be called from a script
 * @public
 */
export type ScriptFunction = (this: ScriptFunctionScope, ...args: ScriptValue[]) => Promise<ScriptValue>;


/**
 * The scope in which a script function is called
 * @public
 */
export interface ScriptFunctionScope {
    /**
     * Specifies whether the function is called in an idempotent scope, in which case it
     * is not allowed to have any side-effects.
     */
    readonly idempotent: boolean;

    /**
     * The context, if any, that was given as a script evaluation option.
     */
    readonly context: unknown;

    /** Key of the function that is being invoked */
    readonly key: string;

    /**
     * Invalidates the script evaluation that invoked the function
     */
    invalidate(): void;

    /**
     * Registers a callback function that shall be invoked when the current script evaluation completes
     * 
     * @param callback - The callback to register
     * 
     * @returns true when the callback was registered, and otherwise false
     * 
     * @remarks
     * This function is optional only for backward compatibility. It is always defined when the script function scope
     * is created by ScriptHost version 1.3+, and it will be marked as required in a future major version.
     */
    onScriptExit?: (callback: () => void) => boolean;

    /**
     * Registers a callback function that shall be invoked when the observer, if any, of the current script 
     * evaluation is completed and therefore no longer observing the evaluation.
     * 
     * @param callback - The callback to register
     * 
     * @returns true when the callback was registered, and otherwise false
     * 
     * @remarks
     * This function is optional and undefined unless the script function is invoked in an observed context.
     */
    onObserverExit?: (callback: () => void) => boolean;
}
