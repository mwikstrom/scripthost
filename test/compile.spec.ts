import { compile } from "../src";

describe("compile", () => {
    it("throws when script is not a string", () => {
        expect(() => compile(null as unknown as string)).toThrow("The script to compile must be a string");
    });
});