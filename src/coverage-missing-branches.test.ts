import { describe, expect, it } from "vitest";
import { convertJsonSchemaToZod } from "./index";

describe("Missing branch coverage", () => {
    describe("array.ts line 100 - items: true case", () => {
        it("should handle items: true", () => {
            const schema = convertJsonSchemaToZod({
                items: true
            });

            // items: true means any items are allowed
            expect(schema.safeParse([]).success).toBe(true);
            expect(schema.safeParse([1, "foo", true]).success).toBe(true);
            expect(schema.safeParse("not array").success).toBe(true); // Non-arrays also valid
        });

        it("should handle items: true with existing array type", () => {
            // Test the case where types.array is already set
            const schema = convertJsonSchemaToZod({
                type: "array",
                items: true
            });

            expect(schema.safeParse([]).success).toBe(true);
            expect(schema.safeParse([1, "foo", true]).success).toBe(true);
        });

        it("should handle items: true with array constraints", () => {
            // Test with minItems to ensure array type exists
            const schema = convertJsonSchemaToZod({
                minItems: 1,
                items: true
            });

            expect(schema.safeParse([1]).success).toBe(true);
            expect(schema.safeParse([]).success).toBe(false); // minItems constraint
        });
    });

    describe("number.ts line 72 - multipleOf: 0 case", () => {
        it("should handle multipleOf: 0", () => {
            const schema = convertJsonSchemaToZod({
                type: "number",
                multipleOf: 0
            });

            // multipleOf: 0 should always be invalid
            expect(schema.safeParse(0).success).toBe(false);
            expect(schema.safeParse(1).success).toBe(false);
            expect(schema.safeParse(5).success).toBe(false);
            expect(schema.safeParse(-3).success).toBe(false);
        });
    });
});