import { ScriptHost } from "../src";

describe("ScriptHost", () => {
    it("cannot init without bridge factory", async () => {
        const host = new ScriptHost();
        await expect(async () => await host.init()).rejects.toThrow("There is no default script sandbox factory");
    });
});