/**
 * A compiled script function
 * @public
 */
export type CompiledScript = () => unknown;

/**
 * Compiles the specified string as javascript
 * @param script - The javascript code to compile
 * @public
 */
export function compile(script: string): CompiledScript {
    if (typeof script !== "string") {
        throw new TypeError("The script to compile must be a string");
    }

    throw new Error("not implemented");
}