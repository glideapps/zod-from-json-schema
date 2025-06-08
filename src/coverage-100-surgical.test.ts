import { describe, it, expect } from "vitest";
import { convertJsonSchemaToZod } from "./index";
import { ItemsHandler } from "./handlers/primitive/array";
import { EnumHandler } from "./handlers/primitive/enum";
import { TupleHandler } from "./handlers/primitive/tuple";
import { EnumComplexHandler } from "./handlers/refinement/enumComplex";
import { PrefixItemsHandler } from "./handlers/refinement/arrayItems";
// TupleItemsHandler removed - tuple handling now done in primitive phase
import { z } from "zod/v4";
import type { TypeSchemas } from "./core/types";

describe("100% Coverage - Surgical Tests", () => {
    describe("Array.ts lines 38-39", () => {
        it("should create array type when items is array but no existing array", () => {
            const handler = new ItemsHandler();
            const types: TypeSchemas = {};
            
            // This should hit lines 38-39
            handler.apply(types, {
                type: "array",
                items: [{ type: "string" }, { type: "number" }] // Array items
            });
            
            expect(types.array).toBeDefined();
            expect(types.array).toBeInstanceOf(z.ZodArray);
        });
    });

    describe("Enum.ts line 50 - defensive return", () => {
        it("should hit defensive return for unknown type", () => {
            const handler = new EnumHandler();
            
            // Create a scenario that might hit line 50
            // This is the defensive return that should never be reached
            const result = handler.createTypeSchema([], "unknown" as any);
            expect(result).toBe(false);
        });
    });

    describe("Tuple.ts line 16 - array false check", () => {
        it("should skip when array type is explicitly false", () => {
            const handler = new TupleHandler();
            const types: TypeSchemas = {
                array: false // Explicitly set to false
            };
            
            // This should hit line 16 and return early
            handler.apply(types, {
                type: "array",
                items: [{ type: "string" }]
            });
            
            // array should remain false, tuple should not be set
            expect(types.array).toBe(false);
            expect(types.tuple).toBeUndefined();
        });
    });

    describe("EnumComplex.ts line 21 - primitive check", () => {
        it("should return true for primitive values in refinement", () => {
            const handler = new EnumComplexHandler();
            
            // Create a scenario with complex enum values
            const schema = {
                enum: [
                    { type: "object", value: 1 },
                    [1, 2, 3],
                    "primitive",
                    42,
                    true
                ]
            };
            
            const result = handler.apply(z.any(), schema);
            
            // Test primitive values - these should hit line 21 and return true
            expect(result.safeParse("primitive").success).toBe(true);
            expect(result.safeParse(42).success).toBe(true);
            expect(result.safeParse(true).success).toBe(true);
            expect(result.safeParse(null).success).toBe(true);
            
            // Test complex values
            expect(result.safeParse({ type: "object", value: 1 }).success).toBe(true);
            expect(result.safeParse([1, 2, 3]).success).toBe(true);
            
            // Test non-matching values
            expect(result.safeParse({ wrong: "object" }).success).toBe(false);
            expect(result.safeParse([4, 5, 6]).success).toBe(false);
        });
    });

    describe("Array items now handled in primitive phase", () => {
        it("should handle array items through converter", () => {
            // Array items are now handled directly in primitive phase
            const schema = {
                type: "array",
                minItems: 1,
                items: { type: "number", minimum: 0 }
            };
            
            const zodSchema = convertJsonSchemaToZod(schema);
            
            // Should work with typed array items
            expect(zodSchema.safeParse([1, 2, 3]).success).toBe(true);
            expect(zodSchema.safeParse([-1]).success).toBe(false);
            expect(zodSchema.safeParse(["string"]).success).toBe(false);
            expect(zodSchema.safeParse([]).success).toBe(false); // minItems
        });
    });

    describe("Tuple handling now in primitive phase", () => {
        it("should handle tuples correctly through converter", () => {
            // Tuples are now handled directly in the primitive phase
            const schema = {
                type: "array",
                items: [{ type: "string" }, { type: "number" }]
            };
            
            const zodSchema = convertJsonSchemaToZod(schema);
            
            // Test the tuple works correctly
            expect(zodSchema.safeParse(["hello", 42]).success).toBe(true);
            expect(zodSchema.safeParse(["wrong", "types"]).success).toBe(false);
        });

        it("should handle tuple in union", () => {
            const schema = {
                anyOf: [
                    {
                        type: "array",
                        items: [{ type: "string" }, { type: "number" }]
                    },
                    { type: "boolean" }
                ]
            };
            
            const zodSchema = convertJsonSchemaToZod(schema);
            expect(zodSchema.safeParse(["hello", 42]).success).toBe(true);
            expect(zodSchema.safeParse(true).success).toBe(true);
            expect(zodSchema.safeParse(["wrong", "types"]).success).toBe(false);
        });
    });

    describe("Integration test to ensure all paths work together", () => {
        it("should handle complex schema that exercises multiple edge cases", () => {
            const schema = {
                anyOf: [
                    {
                        type: "array",
                        items: [{ const: "start" }, { type: "string" }],
                        minItems: 2,
                        maxItems: 2
                    },
                    {
                        enum: [
                            { complex: "object" },
                            ["complex", "array"],
                            "simple",
                            42
                        ]
                    }
                ]
            };
            
            const zodSchema = convertJsonSchemaToZod(schema);
            
            // Test tuple
            expect(zodSchema.parse(["start", "value"])).toEqual(["start", "value"]);
            
            // Test enum values
            expect(zodSchema.parse({ complex: "object" })).toEqual({ complex: "object" });
            expect(zodSchema.parse(["complex", "array"])).toEqual(["complex", "array"]);
            expect(zodSchema.parse("simple")).toBe("simple");
            expect(zodSchema.parse(42)).toBe(42);
            
            // Test failures
            expect(() => zodSchema.parse(["wrong", "start"])).toThrow();
            expect(() => zodSchema.parse({ wrong: "object" })).toThrow();
            expect(() => zodSchema.parse("unknown")).toThrow();
        });
    });
});