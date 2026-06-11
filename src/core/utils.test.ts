import { describe, it, expect } from "vitest";
import { isHazardousPropertyName } from "./utils";

describe("isHazardousPropertyName", () => {
    it("flags names of Object.prototype members", () => {
        expect(isHazardousPropertyName("toString")).toBe(true);
        expect(isHazardousPropertyName("constructor")).toBe(true);
        expect(isHazardousPropertyName("valueOf")).toBe(true);
        expect(isHazardousPropertyName("hasOwnProperty")).toBe(true);
        expect(isHazardousPropertyName("isPrototypeOf")).toBe(true);
        expect(isHazardousPropertyName("__proto__")).toBe(true);
        expect(isHazardousPropertyName("__defineGetter__")).toBe(true);
    });

    it("does not flag ordinary property names", () => {
        expect(isHazardousPropertyName("foo")).toBe(false);
        expect(isHazardousPropertyName("name")).toBe(false);
        expect(isHazardousPropertyName("type")).toBe(false);
        expect(isHazardousPropertyName("")).toBe(false);
        // Inherited but not own members of Object.prototype don't count.
        expect(isHazardousPropertyName("length")).toBe(false);
    });
});
