import { isErrorResponse, ErrorResponse } from "./ErrorResponse";
import { EvaluateScriptRequest } from "./EvaluateScriptRequest";
import { isEvaluateScriptResponse } from "./EvaluateScriptResponse";
import { FunctionCallRequest, isFunctionCallRequest } from "./FunctionCallRequest";
import { FunctionCallResponse } from "./FunctionCallResponse";
import { isGenericMessage, GenericMessage } from "./GenericMessage";
import { isGenericResponse, GenericResponse } from "./GenericResponse";
import { InitializeRequest } from "./InitializeRequest";
import { isInitializeResponse, InitializeResponse } from "./InitializeResponse";
import { isPingRequest, PingRequest } from "./PingRequest";
import { PingResponse } from "./PingResponse";
import { ScriptEvalOptions } from "./ScriptEvalOptions";
import { ScriptObserveOptions } from "./ScriptObserveOptions";
import { ScriptSandbox, ScriptSandboxFactory } from "./ScriptSandbox";
import { ExposedFunctions, ScriptFunctionScope, ScriptHostOptions } from "./ScriptHostOptions";
import { ScriptValue } from "./ScriptValue";

/**
 * The host in which scripts are evaluated
 * @public
 */
export class ScriptHost {
    #factory: ScriptSandboxFactory | null;
    #funcs: ExposedFunctions;
    readonly #pingInterval: number;
    readonly #unresponsiveInterval: number;
    readonly #defaultTimeout: number;
    readonly #initTimeout: number;
    #sandbox: ScriptSandbox | null = null;
    #init: Promise<InitializeResponse> | null = null;
    #messageIdCounter = 0;
    #pingIntervalId: ReturnType<typeof setInterval> | null = null;
    #lastPing: number | null = null;
    readonly #writeObservers = new Set<(written: ReadonlyMap<string, number>) => boolean>();
    readonly #responseHandlers = new Map<string, (response: GenericResponse) => void>();

    /** Constructs the default script sandbox */
    public static createDefaultSandbox(): ScriptSandbox {
        if (!DEFAULT_SANDBOX_FACTORY) {
            throw new Error("There is no default script sandbox factory");
        }

        return DEFAULT_SANDBOX_FACTORY();
    }

    /** Registers the default script sandbox */
    public static setupDefaultSandbox(factory: ScriptSandboxFactory): void {
        DEFAULT_SANDBOX_FACTORY = factory;
    }

    constructor(options: ScriptHostOptions = {}) {
        const { 
            createSandbox = ScriptHost.createDefaultSandbox, 
            expose = {},
            pingInterval = 5000,
            unresponsiveInterval = pingInterval * 2,
            defaultTimeout = 30000,
            initTimeout = defaultTimeout,
        } = options;
        this.#factory = createSandbox;
        this.#funcs = Object.freeze({ ...expose });
        this.#pingInterval = pingInterval;
        this.#unresponsiveInterval = unresponsiveInterval;
        this.#defaultTimeout = defaultTimeout;
        this.#initTimeout = initTimeout;
    }

    /** Determines whether the script host is unresponsive */
    public get isUnresponsive(): boolean {
        if (this.#pingIntervalId === null || this.#lastPing === null || this.#unresponsiveInterval <= 0) {
            return false;
        } else {
            const age = Date.now() - this.#lastPing;
            return age > this.#unresponsiveInterval;
        }
    }

    /** Disposes the script host */
    public dispose(): void {
        this.#disposeSandbox();
        this.#factory = null;
    }

    /**
     * Evaluates the specified script
     * @param script - The script to evaluate
     * @param options - Optional options that control script evaluation
     * @returns A promise that resolve to the result of the evaluation
     */
    public async eval(script: string, options: ScriptEvalOptions = {}): Promise<ScriptValue> {
        const { 
            timeout = this.#defaultTimeout, 
            idempotent,
            instanceId,
            onInvalidated = null,
        } = options;

        const request: EvaluateScriptRequest = {
            type: "eval",
            messageId: this.#nextMessageId(),
            script,
            idempotent,
            instanceId,
            track: onInvalidated !== null,
        };

        const { result, vars } = await this.#request(request, isEvaluateScriptResponse, timeout);

        if (vars && onInvalidated) {
            const dependencies = new Map<string, number>();
            for (const [key, { read, write }] of vars) {
                if (typeof read === "number" && (typeof write !== "number" || read > write)) {
                    dependencies.set(key, read);
                }
            }
            if (dependencies.size > 0) {
                this.#writeObservers.add(mutations => {
                    let invalidated = false;
                    
                    for (const [key, timestamp] of dependencies) {
                        const written = mutations.get(key);
                        if (typeof written === "number" && written > timestamp) {
                            invalidated = true;
                            break;
                        }
                    }

                    if (invalidated) {
                        try {
                            onInvalidated();
                        } catch (err) {
                            console.error("Script invalidation handler threw exception:", err);
                        }
                    }

                    return invalidated;
                });
            }
        }

        return result;
    }

    /**
     * Explicitly initializes the script host.
     * @remarks
     * You don't need to call this method. The script host is initialized automatically when needed.
     */
    public async init(): Promise<void> {
        await this.#ensureInitialized();
    }

    /**
     * Observes the specified script
     * @param script - The script to observe
     * @param options - Options that control the observation
     * @returns A callback that shall be invoked to cancel the observation
     */
    public observe(script: string, options: ScriptObserveOptions): (this: void) => void {
        const { onNext, onError, ...rest } = options;
        let active = true;

        const evalOptions: ScriptEvalOptions = {
            ...rest,
            idempotent: true,
            onInvalidated: () => {
                if (active) {
                    evalNext();
                }
            },
        };        

        const evalNext = () => this.eval(script, evalOptions).then(
            value => {
                if (active) {
                    onNext(value);
                }
            },
            error => {
                if (active && onError) {
                    onError(error);
                }
            }
        );        

        evalNext();
        return () => { active = false; };
    }

    /** Resets the current script host */
    public reset(): void {
        this.#assertNotDisposed();
        this.#disposeSandbox();
    }

    async #request<T extends GenericResponse>(
        request: GenericMessage,
        predicate: (response: GenericResponse) => response is T,
        timeout: number,
    ): Promise<T> {
        timeout -= await this.#ensureInitialized();
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.#sandbox!.post(request);
        return await this.#waitForResponse(request, predicate, timeout);
    }

    async #ensureInitialized(): Promise<number> {
        this.#assertNotDisposed();

        if (this.#sandbox === null) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.#sandbox = this.#factory!();
            this.#sandbox.listen(() => this.#handleMessage);
            if (this.#pingInterval > 0) {
                this.#pingIntervalId = setInterval(() => this.#postPingIfNeeded, this.#pingInterval);
            }
        }

        if (this.#init === null) {
            const initRequest: InitializeRequest = {
                type: "init",
                messageId: this.#nextMessageId(),
                funcs: new Set(Object.keys(this.#funcs)),
            };
            this.#sandbox.post(initRequest);           
            this.#init = this.#waitForResponse(initRequest, isInitializeResponse, this.#initTimeout);
        }

        const initWaitStart = Date.now();
        await this.#init;
        return Math.max(0, Date.now() - initWaitStart);
    }

    #postPingIfNeeded(): void {
        if (this.#sandbox !== null && this.#shouldPostPing()) {
            const pingMessage: PingRequest = {
                type: "ping",
                messageId: this.#nextMessageId(),
            };
            this.#sandbox.post(pingMessage);
        }
    }

    #shouldPostPing(): boolean {
        if (this.#lastPing === null) {
            return true;
        } else {
            const age = Date.now() - this.#lastPing;
            return age > this.#pingInterval;
        }
    }

    #disposeSandbox(): void {
        if (this.#sandbox !== null) {
            this.#sandbox.dispose();
            this.#sandbox = null;
        }

        if (this.#pingIntervalId !== null) {
            clearInterval(this.#pingIntervalId);
            this.#pingIntervalId = null;
        }
    
        this.#responseHandlers.clear();
        this.#writeObservers.clear();
        this.#init = null;
        this.#lastPing = null;
    }

    #handleMessage(message: ScriptValue): void {
        if (this.#sandbox === null) {
            return;
        }

        this.#lastPing = Date.now();
        
        if (isPingRequest(message)) {
            const pingResponse: PingResponse = {
                type: "pong",
                messageId: this.#nextMessageId(),
                inResponseTo: message.messageId,
            };
            this.#sandbox.post(pingResponse);
        } else if (isFunctionCallRequest(message)) {
            this.#handleFunctionCall(message);
        } else if (isGenericResponse(message)) {
            const handler = this.#responseHandlers.get(message.inResponseTo);

            if (handler) {
                this.#responseHandlers.delete(message.messageId);
                try {
                    handler(message);
                } catch (err) {
                    console.error("Exception in response handler:", err);
                }
            }

            if (isEvaluateScriptResponse(message) && this.#writeObservers.size > 0) {
                const { vars } = message;
                if (vars) {
                    const written = new Map<string, number>();
                    for (const [key, tracked] of vars) {
                        if (typeof tracked.write === "number") {
                            written.set(key, tracked.write);
                        }
                    }

                    Object.freeze(written);
                    const done = new Set<(written: ReadonlyMap<string, number>) => boolean>();
                    for (const observer of this.#writeObservers) {
                        let keep = false;
                        try {
                            keep = !observer(written);
                        } catch (err) {
                            console.error("Exception in variable observer:", err);
                        }
                        if (!keep) {
                            done.add(observer);
                        }
                    }

                    for (const observer of done) {
                        this.#writeObservers.delete(observer);
                    }
                }
            }
        } else if (isGenericMessage(message)) {
            const errorResponse: ErrorResponse = {
                type: "error",
                messageId: this.#nextMessageId(),
                inResponseTo: message.messageId,
                message: `Unsupported request: ${message.type}`,
            };
            this.#sandbox.post(errorResponse);
        } 
    }

    async #handleFunctionCall(request: FunctionCallRequest): Promise<void> {
        if (this.#sandbox === null) {
            return;
        }

        const func = this.#funcs[request.key];
        if (!func) {
            const errorResponse: ErrorResponse = {
                type: "error",
                messageId: this.#nextMessageId(),
                inResponseTo: request.messageId,
                message: `Cannot call undefined function: ${request.key}`,
            };
            this.#sandbox.post(errorResponse);
            return;
        }

        try {
            const scope: ScriptFunctionScope = {
                idemponent: request.idempotent,
            };
            const result = await func.bind(scope)(...request.args);
            const response: FunctionCallResponse = {
                type: "return",
                messageId: this.#nextMessageId(),
                inResponseTo: request.messageId,
                result,
            };
            this.#sandbox.post(response);
        } catch (err) {
            const response: ErrorResponse = {
                type: "error",
                messageId: this.#nextMessageId(),
                inResponseTo: request.messageId,
                message: String(err),
            };
            this.#sandbox.post(response);
        }
    }

    #waitForResponse<T extends GenericResponse>(
        request: GenericMessage,
        predicate: (response: GenericResponse) => response is T,
        timeout: number,
    ): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timeoutId = timeout > 0 ? setTimeout(
                () => reject(new Error("Did not receive a response within the specified timeout")),
                timeout
            ) : null;

            this.#responseHandlers.set(request.messageId, response => {
                if (timeoutId !== null) {
                    clearTimeout(timeoutId);
                }

                if (predicate(response)) {
                    resolve(response);
                } else if (isErrorResponse(response)) {
                    reject(new Error(response.message));
                } else {
                    reject(new Error(`Received unexpected response '${response.type}' to request '${request.type}'`));
                }
            });
        });
    }

    #nextMessageId(): string {
        return `host-${++this.#messageIdCounter}`;
    }

    #assertNotDisposed(): void {
        if (this.#factory === null) {
            throw new Error("Script host is disposed");
        }
    }
}

let DEFAULT_SANDBOX_FACTORY: ScriptSandboxFactory | null = null;
