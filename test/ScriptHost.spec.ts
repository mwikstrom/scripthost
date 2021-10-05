import { ScriptHost } from "../src";
import { InlineScriptSandbox } from "scripthost-inline";

describe("ScriptHost", () => {
    it("can initialize explicitly", async () => {
        const host = createTestHost();
        let idleChangeCount = 0;
        host.onIdleChange(() => void(++idleChangeCount));
        await host.init();
        expect(host.isInitialized).toBe(true);
        expect(host.isIdle).toBe(true);
        host.dispose();
        expect(host.isDisposed).toBe(true);
        expect(idleChangeCount).toBe(2);
    });

    it("can initialize implicitly", async () => {
        const host = createTestHost();
        let idleChangeCount = 0;
        host.onIdleChange(() => void(++idleChangeCount));
        await host.eval("true");
        expect(host.isInitialized).toBe(true);
        expect(host.isIdle).toBe(true);
        host.dispose();
        expect(host.isDisposed).toBe(true);
        expect(idleChangeCount).toBe(2);
    });
});

const createTestHost = (): ScriptHost => new ScriptHost(
    () => new InlineScriptSandbox(),
    {
        defaultTimeout: 1000,
    }
);