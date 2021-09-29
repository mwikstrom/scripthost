import { ScriptHost } from "../src";

describe("ScriptHost", () => {
    it("cannot create without bridge factory", async () => {
        expect(() => new ScriptHost()).toThrow("There is no default script host bridge factory");
    });
});