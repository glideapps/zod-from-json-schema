import { describe, expect, it } from "vitest";
import { convertJsonSchemaToZod } from "./index";

describe("contains keyword", () => {
    it("should validate basic contains with minimum constraint", () => {
        const schema = convertJsonSchemaToZod({
            contains: { minimum: 5 }
        });

        expect(schema.safeParse([3, 4, 5]).success).toBe(true);
        expect(schema.safeParse([6, 7, 8]).success).toBe(true);
        expect(schema.safeParse([3, 4, 5, 6]).success).toBe(true);
        expect(schema.safeParse([1, 2, 3, 4]).success).toBe(false);
        expect(schema.safeParse([]).success).toBe(false);
        expect(schema.safeParse("not an array").success).toBe(true);
    });

    it("should validate contains with const", () => {
        const schema = convertJsonSchemaToZod({
            contains: { const: 5 }
        });

        expect(schema.safeParse([3, 4, 5]).success).toBe(true);
        expect(schema.safeParse([3, 4, 5, 5]).success).toBe(true);
        expect(schema.safeParse([1, 2, 3, 4]).success).toBe(false);
    });

    it("should validate contains with boolean schema true", () => {
        const schema = convertJsonSchemaToZod({
            contains: true
        });

        expect(schema.safeParse(["foo"]).success).toBe(true);
        expect(schema.safeParse([1, 2, 3]).success).toBe(true);
        expect(schema.safeParse([]).success).toBe(false);
    });

    it("should validate contains with boolean schema false", () => {
        const schema = convertJsonSchemaToZod({
            contains: false
        });

        expect(schema.safeParse(["foo"]).success).toBe(false);
        expect(schema.safeParse([1, 2, 3]).success).toBe(false);
        expect(schema.safeParse([]).success).toBe(false);
        expect(schema.safeParse("not an array").success).toBe(true);
    });

    it("should validate minContains", () => {
        const schema = convertJsonSchemaToZod({
            contains: { const: 1 },
            minContains: 2
        });

        expect(schema.safeParse([]).success).toBe(false);
        expect(schema.safeParse([1]).success).toBe(false);
        expect(schema.safeParse([1, 1]).success).toBe(true);
        expect(schema.safeParse([1, 1, 1]).success).toBe(true);
        expect(schema.safeParse([1, 2, 1]).success).toBe(true);
    });

    it("should validate maxContains", () => {
        const schema = convertJsonSchemaToZod({
            contains: { const: 1 },
            maxContains: 2
        });

        expect(schema.safeParse([1]).success).toBe(true);
        expect(schema.safeParse([1, 1]).success).toBe(true);
        expect(schema.safeParse([1, 1, 1]).success).toBe(false);
        expect(schema.safeParse([1, 2, 1]).success).toBe(true);
    });

    it("should validate minContains = 0 special case", () => {
        const schema = convertJsonSchemaToZod({
            contains: { const: 1 },
            minContains: 0
        });

        expect(schema.safeParse([]).success).toBe(true);
        expect(schema.safeParse([2]).success).toBe(true);
        expect(schema.safeParse([1]).success).toBe(true);
    });

    it("should validate combined min/max constraints", () => {
        const schema = convertJsonSchemaToZod({
            contains: { const: 1 },
            minContains: 1,
            maxContains: 3
        });

        expect(schema.safeParse([]).success).toBe(false);
        expect(schema.safeParse([1, 1]).success).toBe(true);
        expect(schema.safeParse([1, 1, 1, 1]).success).toBe(false);
    });

    it("should work with items interaction", () => {
        const schema = convertJsonSchemaToZod({
            items: { multipleOf: 2 },
            contains: { multipleOf: 3 }
        });

        expect(schema.safeParse([2, 4, 8]).success).toBe(false); // items match, contains doesn't
        expect(schema.safeParse([3, 6, 9]).success).toBe(false); // contains match, items don't
        expect(schema.safeParse([6, 12]).success).toBe(true); // both match
        expect(schema.safeParse([1, 5]).success).toBe(false); // neither match
    });

    it("should handle null elements", () => {
        const schema = convertJsonSchemaToZod({
            contains: { type: "null" }
        });

        expect(schema.safeParse([null]).success).toBe(true);
        expect(schema.safeParse([1, null, 2]).success).toBe(true);
        expect(schema.safeParse([1, 2, 3]).success).toBe(false);
    });
});