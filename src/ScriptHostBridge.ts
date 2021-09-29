import { ScriptValue } from "./ScriptValue";

/**
 * Bridge to the underlying script sandbox
 * @public
 */
export interface ScriptHostBridge {
    dispose(): void;
    post(message: ScriptHostInputMessage): void;
    listen(handler: (message: ScriptHostOutputMessage) => void): () => void;
}

/**
 * Alias for a function that construct {@link ScriptHostBridge} instances
 * @public
 */
export type ScriptHostBridgeFactory = () => ScriptHostBridge;

/**
 * Alias for messages that are sent to a {@link ScriptHostBridge}
 * @public
 */
export type ScriptHostInputMessage = (
    EvaluateScriptRequest
);

/**
 * Alias for messages that are received from a {@link ScriptHostBridge}
 * @public
 */
export type ScriptHostOutputMessage = (
    EvaluateScriptResponse
);

/**
 * The message that is sent to request script evaluation
 * @public
 */
export interface EvaluateScriptRequest {
    type: "eval";
    correlationId: string;
    script: string;
    pure?: boolean;
    track?: boolean;
}

/**
 * The response that is sent back after script evaluation
 * @public
 */
export interface EvaluateScriptResponse {
    type: "result";
    correlationId: string;
    result: ScriptValue;
    error?: string;
    vars?: Record<string, TrackedVariable>;
}

/**
 * A tracked variable
 * @public
 */
export interface TrackedVariable {
    version: number;
    read?: boolean;
    write?: boolean;
}
