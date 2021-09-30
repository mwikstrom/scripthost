/** @internal */
export function isObject(thing: unknown): thing is Record<string | number | symbol, unknown> {
    return typeof thing === "object" && thing !== null;
}

/** @internal */
export function isString(thing: unknown): thing is string {
    return hasType(thing, "string");
}

const hasType = (thing: unknown, ...type: string[]) => type.includes(typeof thing);
