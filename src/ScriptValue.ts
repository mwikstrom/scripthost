/**
 * A script value
 * @public
 */
export type ScriptValue = (
    boolean |
    null |
    undefined |
    number |
    BigInt |
    string |
    Date |
    RegExp |
    Blob |
    File |
    FileList |
    ArrayBuffer |
    ArrayBufferView |
    ImageBitmap |
    ImageData |
    Array<ScriptValue> |
    Map<ScriptValue, ScriptValue> |
    Set<ScriptValue> |
    ScriptObject
);

/**
 * A script object
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ScriptObject extends Record<string, ScriptValue> {}
