import { describe, it, expect } from "vitest";
import { z } from "zod/v4";
import { unwrapPreprocess } from "./utils";

describe("unwrapPreprocess", () => {
    it("returns the schema unchanged when no preprocess wrappers are present", () => {
        const base = z.object({ foo: z.string() });
        expect(unwrapPreprocess(base)).toBe(base);
    });

    it("unwraps single preprocess layers applied during conversion", () => {
        const base = z.object({ foo: z.string() });
        const wrapped = z.preprocess((value) => value, base);
        expect(unwrapPreprocess(wrapped)).toBe(base);
    });

    it("unwraps nested preprocess and pipe combinations", () => {
        const base = z.object({ foo: z.string() });
        const wrapped = z
            .preprocess((value) => value, base)
            .pipe(base);

        expect(unwrapPreprocess(wrapped)).toBe(base);
    });
});
