import { ScriptHost } from "../src";
import { InlineScriptSandbox } from "scripthost-inline";
import { ScriptValue } from "scripthost-core";

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

    it("can observe script", async () => {
        const host = createTestHost();
        const received: ScriptValue[] = [];
        const stop = host.observe("value || 0", { onNext: value => received.push(value) });
        await host.whenIdle();
        host.eval("value = 1");
        await host.whenIdle();
        host.eval("++value");
        await host.whenIdle();
        stop();
        host.eval("++value");
        await host.whenIdle();
        expect(received).toMatchObject([0, 1, 2]);
    });
});

const createTestHost = (): ScriptHost => new ScriptHost(
    () => new InlineScriptSandbox(),
    {
        defaultTimeout: 1000,
    }
);