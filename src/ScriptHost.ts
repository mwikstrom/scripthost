import { ScriptEvalOptions } from "./ScriptEvalOptions";
import { ScriptObserveOptions } from "./ScriptObserveOptions";
import { ExposedFunctions, ScriptFunctionScope, ScriptHostOptions } from "./ScriptHostOptions";
import { 
    ErrorResponse, 
    EvaluateScriptRequest, 
    EvaluateScriptResponse, 
    FunctionCallRequest, 
    FunctionCallResponse, 
    GenericMessage, 
    GenericResponse, 
    InitializeRequest, 
    InitializeResponse, 
    isErrorResponse, 
    isEvaluateScriptResponse, 
    isFunctionCallRequest, 
    isGenericMessage, 
    isGenericResponse, 
    isInitializeResponse, 
    isPingRequest, 
    isYieldRequest, 
    PingRequest, 
    PingResponse, 
    ScriptSandbox, 
    ScriptSandboxFactory, 
    ScriptValue, 
    YieldRequest,
    YieldResponse
} from "scripthost-core";
import { nanoid } from "nanoid";

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
    #initPromise: Promise<InitializeResponse> | null = null;
    #isInitialized = false;
    #messageIdCounter = 0;
    #pingIntervalId: ReturnType<typeof setInterval> | null = null;
    #lastPing: number | null = null;
    readonly #writeObservers = new Map<string, (written: ReadonlyMap<string, number>) => boolean>();
    readonly #responseHandlers = new Map<string, (response: GenericResponse) => void>();
    readonly #messageIdPrefix: string;
    readonly #onIdleChangeHandlers = new Map<(idle: boolean) => void, number>();
    readonly #activeScopes = new Map<string, Omit<ScriptFunctionScope, "idempotent">>();
    #stopListening: (() => void) | null = null;

    constructor(factory: ScriptSandboxFactory, options: ScriptHostOptions = {}) {
        const { 
            expose = {},
            pingInterval = 5000,
            unresponsiveInterval = pingInterval * 2,
            defaultTimeout = 300000, // 5 minutes
            initTimeout = defaultTimeout,
            messageIdPrefix = `host-${nanoid()}-`,
        } = options;
        this.#factory = factory;
        this.#funcs = Object.freeze({ ...expose });
        this.#pingInterval = pingInterval;
        this.#unresponsiveInterval = unresponsiveInterval;
        this.#defaultTimeout = defaultTimeout;
        this.#initTimeout = initTimeout;
        this.#messageIdPrefix = messageIdPrefix;
    }

    /** Gets the exposed functions */
    public get funcs(): ExposedFunctions {
        return this.#funcs;
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

    /** Determines whether the script host is idle */
    public get isIdle(): boolean {
        return this.#responseHandlers.size === 0;
    }

    /** Determines whether the script host is initialized */
    public get isInitialized(): boolean {
        return this.#isInitialized;
    }

    /** Determines whether the script host is disposed */
    public get isDisposed(): boolean {
        return this.#factory === null;
    }

    /** Disposes the script host */
    public dispose(): void {
        this.#disposeSandbox();
        this.#factory = null;
        this.#isInitialized = false;
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
            vars: input,
            onInvalidated = null,
        } = options;

        const request: EvaluateScriptRequest = {
            type: "eval",
            messageId: this.#nextMessageId(),
            script,
            idempotent,
            instanceId,
            vars: input,
            // Note: We must track variables for all non-idempotent scripts even when we currently does
            // not have a registered write observer because a concurrent eval may end up registering
            // a write observer that is dependent on the current eval.
            track: onInvalidated !== null || !idempotent,
        };

        let refreshTimer: ReturnType<typeof setTimeout> | undefined;
        let invalidated = false;
        let observer: ((mutations: ReadonlyMap<string, number>) => boolean) | undefined;

        const invalidate = onInvalidated ? () => {
            if (!invalidated) {
                invalidated = true;

                try {
                    onInvalidated();
                } catch (err) {
                    console.error("Script invalidation handler threw exception:", err);
                }
            }

            if (refreshTimer !== void(0)) {
                clearTimeout(refreshTimer);
                refreshTimer = void(0);
            }

            if (observer !== void(0)) {
                if (this.#writeObservers.get(request.messageId) === observer) {
                    this.#writeObservers.delete(request.messageId);
                }
                observer = void(0);
            }
        } : null;

        let response: EvaluateScriptResponse | ErrorResponse;
        let active = true;
        this.#activeScopes.set(request.messageId, {
            context: options.context,
            invalidate: () => {
                // don't invalidate while active
                if (!active && invalidate) {
                    invalidate();
                }
            },
        });
        try {
            response = await this.#request(request, isEvaluateScriptOrErrorResponse, timeout);
        } finally {
            active = false;
            this.#activeScopes.delete(request.messageId);
        }

        const { vars, refresh } = response;

        if (vars && invalidate) {
            const dependencies = new Map<string, number>();
            
            for (const [key, { read, write }] of vars) {
                if (typeof read === "number" && (typeof write !== "number" || read > write)) {
                    dependencies.set(key, read);
                }
            }

            if (dependencies.size > 0) {
                this.#writeObservers.set(request.messageId, observer = mutations => {
                    for (const [key, timestamp] of dependencies) {
                        const written = mutations.get(key);
                        if (typeof written === "number" && written > timestamp) {
                            invalidate();
                            break;
                        }
                    }
                    return invalidated;
                });
            }
        }

        if (refresh !== void(0) && refresh !== false) {
            if (typeof refresh !== "number") {
                console.warn("Ignoring invalid refresh variable from script evaluation:", refresh);
            } else if (refresh > 0 && invalidate) {
                refreshTimer = setTimeout(invalidate, refresh);
            }
        }

        if (isErrorResponse(response)) {
            throw new Error(response.message);
        } else {
            return response.result;
        }
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

    /**
     * Registers a listener callback that shall be invoked whenever the idle status changes
     * @param callback - The callback that shall be invoked whenever the idle status changes
     * @returns A callback that shall be invoked to stop listening
     */
    public onIdleChange(callback: (idle: boolean) => void): () => void {
        let active = true;
        this.#onIdleChangeHandlers.set(callback, (this.#onIdleChangeHandlers.get(callback) ?? 0) + 1);
        return () => {
            if (active) {
                let count: number;
                this.#onIdleChangeHandlers.set(callback, count = (this.#onIdleChangeHandlers.get(callback) ?? 0) - 1);
                if (count <= 0) {
                    this.#onIdleChangeHandlers.delete(callback);
                }
                active = false;
            }
        };
    }

    /** Resets the current script host */
    public reset(): void {
        this.#assertNotDisposed();
        this.#disposeSandbox();
    }

    /** Returns a promise that is resolved when the script host is idle */
    public async whenIdle(debounce = 0): Promise<void> {
        await new Promise<void>(resolve => {
            let timerId: ReturnType<typeof setTimeout> | null = null;
            const check = (idle: boolean) => {
                if (timerId !== null) {
                    clearTimeout(timerId);
                }

                if (idle) {
                    timerId = setTimeout(() => {
                        resolve();
                        stop();
                    }, debounce);
                }
            };
            const stop = this.onIdleChange(check);
            check(this.isIdle);
        });
    }

    async #request<T extends GenericResponse>(
        request: GenericMessage,
        predicate: (response: GenericResponse) => response is T,
        timeout: number,
    ): Promise<T> {
        const promise = this.#waitForResponse(request, predicate, timeout);
        const sandbox = await this.#ensureInitialized();
        sandbox.post(request);
        return await promise;
    }

    async #ensureInitialized(): Promise<ScriptSandbox> {
        this.#assertNotDisposed();

        if (this.#sandbox === null) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.#sandbox = this.#factory!();
            this.#stopListening = this.#sandbox.listen(message => this.#handleMessage(message));
            if (this.#pingInterval > 0) {
                this.#pingIntervalId = setInterval(() => this.#postPingIfNeeded(), this.#pingInterval);
            }
        }

        if (this.#initPromise === null) {
            const initRequest: InitializeRequest = {
                type: "init",
                messageId: this.#nextMessageId(),
                funcs: new Set(Object.keys(this.#funcs)),
            };
            this.#initPromise = this.#waitForResponse(initRequest, isInitializeResponse, this.#initTimeout);
            this.#sandbox.post(initRequest);           
        }

        await this.#initPromise;
        this.#isInitialized = true;
        return this.#sandbox;
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
        if (this.#stopListening !== null) {
            this.#stopListening();
            this.#stopListening = null;
        }

        if (this.#sandbox !== null) {
            this.#sandbox.dispose();
            this.#sandbox = null;
        }

        if (this.#pingIntervalId !== null) {
            clearInterval(this.#pingIntervalId);
            this.#pingIntervalId = null;
        }

        if (this.#responseHandlers.size > 0) {    
            this.#responseHandlers.clear();
            this.#notifyIdle(true);
        }

        this.#writeObservers.clear();
        this.#initPromise = null;
        this.#lastPing = null;
    }

    #handleMessage(message: ScriptValue): void {
        const sandbox = this.#sandbox;

        if (sandbox === null) {
            return;
        }

        this.#lastPing = Date.now();
        
        if (isPingRequest(message)) {
            const pingResponse: PingResponse = {
                type: "pong",
                messageId: this.#nextMessageId(),
                inResponseTo: message.messageId,
            };
            sandbox.post(pingResponse);
        } else if (isFunctionCallRequest(message)) {
            this.#handleFunctionCall(message);
        } else if (isYieldRequest(message)) {
            this.#handleYield(message);
        } else if (isGenericResponse(message)) {
            const handler = this.#responseHandlers.get(message.inResponseTo);

            if (handler) {
                try {
                    handler(message);
                } catch (err) {
                    console.error("Exception in response handler:", err);
                }
            }

            if (isEvaluateScriptOrErrorResponse(message) && this.#writeObservers.size > 0) {
                const { vars } = message;
                if (vars) {
                    const written = new Map<string, number>();
                    for (const [key, tracked] of vars) {
                        if (typeof tracked.write === "number") {
                            written.set(key, tracked.write);
                        }
                    }
                    this.#handleWrittenVariables(Object.freeze(written));
                }
            }

            if (handler) {
                this.#responseHandlers.delete(message.inResponseTo);
                if (this.#responseHandlers.size === 0) {
                    this.#notifyIdle(true);
                }
            }
        } else if (isGenericMessage(message)) {
            const errorResponse: ErrorResponse = {
                type: "error",
                messageId: this.#nextMessageId(),
                inResponseTo: message.messageId,
                message: `Unsupported request: ${message.type}`,
            };
            sandbox.post(errorResponse);
        } 
    }

    #handleWrittenVariables(written: ReadonlyMap<string, number>): void {
        const done = new Set<string>();
        for (const [key, observer] of this.#writeObservers) {
            let keep = false;
            try {
                keep = !observer(written);
            } catch (err) {
                console.error("Exception in variable observer:", err);
            }
            if (!keep) {
                done.add(key);
            }
        }

        for (const key of done) {
            this.#writeObservers.delete(key);
        }
    }

    async #handleFunctionCall(request: FunctionCallRequest): Promise<void> {
        const sandbox = this.#sandbox;

        if (sandbox === null) {
            return;
        }

        const { written } = request;
        if (written) {
            this.#handleWrittenVariables(Object.freeze(written));
        }

        const func = this.#funcs[request.key];
        if (!func) {
            const errorResponse: ErrorResponse = {
                type: "error",
                messageId: this.#nextMessageId(),
                inResponseTo: request.messageId,
                message: `Cannot call undefined function: ${request.key}`,
            };
            sandbox.post(errorResponse);
            return;
        }

        const active = this.#activeScopes.get(request.correlationId);
        if (!active) {
            const errorResponse: ErrorResponse = {
                type: "error",
                messageId: this.#nextMessageId(),
                inResponseTo: request.messageId,
                message: "Cannot call function from an inactive script",
            };
            sandbox.post(errorResponse);
            return;
        }

        try {
            const scope: ScriptFunctionScope = {
                ...active,
                idempotent: request.idempotent,
            };
            const result = await func.bind(scope)(...request.args);
            const response: FunctionCallResponse = {
                type: "return",
                messageId: this.#nextMessageId(),
                inResponseTo: request.messageId,
                result,
            };
            sandbox.post(response);
        } catch (err) {
            const response: ErrorResponse = {
                type: "error",
                messageId: this.#nextMessageId(),
                inResponseTo: request.messageId,
                message: String(err),
            };
            sandbox.post(response);
        }
    }

    #handleYield(request: YieldRequest): void {
        const sandbox = this.#sandbox;

        if (sandbox === null) {
            return;
        }

        const { written } = request;
        if (written) {
            this.#handleWrittenVariables(Object.freeze(written));
        }

        const response: YieldResponse = {
            type: "continue",
            messageId: this.#nextMessageId(),
            inResponseTo: request.messageId,
        };

        sandbox.post(response);
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

            if (this.#responseHandlers.size === 1) {
                this.#notifyIdle(false);
            }
        });
    }

    #notifyIdle(value: boolean): void {
        for (const callback of this.#onIdleChangeHandlers.keys()) {
            try {
                callback(value);
            } catch (err) {
                console.error("Exception in idle change handler:", err);
            }
        }
    }

    #nextMessageId(): string {
        return `${this.#messageIdPrefix}${++this.#messageIdCounter}`;
    }

    #assertNotDisposed(): void {
        if (this.#factory === null) {
            throw new Error("Script host is disposed");
        }
    }
}

function isEvaluateScriptOrErrorResponse(message: unknown): message is EvaluateScriptResponse | ErrorResponse {
    return isEvaluateScriptResponse(message) || isErrorResponse(message);
}