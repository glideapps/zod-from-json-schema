import { describe, it, expect } from "vitest";
import { convertJsonSchemaToZod } from "./index";
import { createUniqueItemsValidator } from "./core/utils";
import { MaxLengthHandler } from "./handlers/primitive/string";
import { z } from "zod/v4";
import type { TypeSchemas } from "./core/types";

describe("Final Coverage - Uncovered Lines", () => {
    describe("utils.ts lines 10-11 - non-array in uniqueItems", () => {
        it("should return true for non-array values", () => {
            const validator = createUniqueItemsValidator();
            
            // Test the uncovered lines 10-11 - non-array values should return true
            expect(validator("string")).toBe(true);
            expect(validator(123)).toBe(true);
            expect(validator(null)).toBe(true);
            expect(validator({})).toBe(true);
            expect(validator(true)).toBe(true);
        });
    });

    describe("string.ts line 40 - maxLength with non-ZodString", () => {
        it("should handle maxLength when types.string is not a ZodString", () => {
            const handler = new MaxLengthHandler();
            const literal = z.literal("fixed");
            const types: TypeSchemas = {
                // Set types.string to something that's not a ZodString instance
                string: literal
            };
            
            // This should hit line 40 where currentString is set but not instanceof ZodString
            handler.apply(types, { maxLength: 5 });
            
            // The handler should not modify the string type when it's not a ZodString
            expect(types.string).toBe(literal);
        });

        it("should handle maxLength when types.string is undefined", () => {
            const handler = new MaxLengthHandler();
            const types: TypeSchemas = {
                // types.string is undefined, should hit the || z.string() branch
            };
            
            handler.apply(types, { maxLength: 10 });
            
            // Should create a string with custom refinement for Unicode-aware maxLength
            expect(types.string).toBeDefined();
            // Test the validation behavior instead of internal structure
            expect(types.string!.safeParse("hello").success).toBe(true);     // 5 chars, valid
            expect(types.string!.safeParse("this is too long").success).toBe(false); // too long
            expect(types.string!.safeParse("💩💩💩💩💩").success).toBe(true);  // 5 graphemes, valid
        });
    });

    describe("tuple.ts lines 35-36 - minItems constraint violation", () => {
        it("should return z.never() when minItems > tuple length", () => {
            const schema = {
                type: "array",
                items: [{ type: "string" }], // Tuple with 1 item
                minItems: 3 // But requires at least 3 items
            };
            
            const zodSchema = convertJsonSchemaToZod(schema);
            
            // Should result in z.never() since it's impossible to satisfy
            expect(zodSchema.safeParse(["a"]).success).toBe(false);
            expect(zodSchema.safeParse(["a", "b", "c"]).success).toBe(false);
            expect(zodSchema.safeParse([]).success).toBe(false);
        });
    });

    describe("tuple.ts lines 40-41 - maxItems constraint violation", () => {
        it("should return z.never() when maxItems < tuple length", () => {
            const schema = {
                type: "array", 
                items: [{ type: "string" }, { type: "number" }, { type: "boolean" }], // Tuple with 3 items
                maxItems: 1 // But allows at most 1 item
            };
            
            const zodSchema = convertJsonSchemaToZod(schema);
            
            // Should result in z.never() since it's impossible to satisfy
            expect(zodSchema.safeParse(["a"]).success).toBe(false);
            expect(zodSchema.safeParse([]).success).toBe(false);
            expect(zodSchema.safeParse(["a", 1, true]).success).toBe(false);
        });
    });

    describe("objectProperties.ts lines 85-86 - additionalProperties false", () => {
        it("should reject objects with additional properties", () => {
            const schema = {
                anyOf: [
                    { type: "string" },
                    {
                        properties: {
                            name: { type: "string" }
                        },
                        additionalProperties: false
                    }
                ]
            };
            
            const zodSchema = convertJsonSchemaToZod(schema);
            
            // This should hit lines 85-86 in objectProperties refinement handler
            // when checking for additional properties in the union case
            expect(zodSchema.safeParse({ name: "valid" }).success).toBe(true);
            expect(zodSchema.safeParse({ name: "valid", extra: "invalid" }).success).toBe(false);
            expect(zodSchema.safeParse("string is also valid").success).toBe(true);
        });
    });
});