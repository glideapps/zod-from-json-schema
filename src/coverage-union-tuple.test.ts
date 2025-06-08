import { describe, it, expect } from "vitest";
import { convertJsonSchemaToZod } from "./index";
import { PrefixItemsHandler } from "./handlers/refinement/arrayItems";
// TupleItemsHandler removed - tuple handling now done in primitive phase
import { z } from "zod/v4";

describe("Union Tuple Replacement Coverage", () => {
    describe("Array items handled in primitive phase", () => {
        it("should handle array items through converter", () => {
            // Array items are now handled in primitive phase  
            const schema = {
                type: "array",
                items: { type: "number", minimum: 0 }
            };
            
            const zodSchema = convertJsonSchemaToZod(schema);
            expect(zodSchema.parse([1, 2, 3])).toEqual([1, 2, 3]);
            expect(() => zodSchema.parse([-1])).toThrow();
        });
    });

    describe("TupleItems union replacement", () => {
        it("should replace tuple in union created by anyOf", () => {
            // This specific test targets the union replacement at lines 46-50
            const schema = {
                anyOf: [
                    {
                        type: "array",
                        items: [{ type: "string" }, { type: "number" }],
                        minItems: 2,
                        maxItems: 2
                    },
                    { type: "boolean" }
                ]
            };
            
            const zodSchema = convertJsonSchemaToZod(schema);
            
            // Test tuple option
            expect(zodSchema.parse(["hello", 42])).toEqual(["hello", 42]);
            
            // Test boolean option
            expect(zodSchema.parse(true)).toBe(true);
            expect(zodSchema.parse(false)).toBe(false);
            
            // Test invalid values
            expect(() => zodSchema.parse(["hello"])).toThrow(); // wrong tuple length
            expect(() => zodSchema.parse([42, "hello"])).toThrow(); // wrong tuple types
            expect(() => zodSchema.parse("string")).toThrow(); // not in union
        });

        it("should handle tuple conversion through converter", () => {
            // Test tuple handling through the converter now that it's in primitive phase
            const schema = {
                type: "array",
                items: [{ type: "string" }, { type: "number" }]
            };
            
            const zodSchema = convertJsonSchemaToZod(schema);
            expect(zodSchema.safeParse(["hello", 42]).success).toBe(true);
            expect(zodSchema.safeParse(["wrong", "types"]).success).toBe(false);
        });

        it("should handle tuple in complex nested union", () => {
            const schema = {
                allOf: [
                    {
                        anyOf: [
                            {
                                type: "array",
                                items: [{ const: "type1" }, { type: "string" }]
                            },
                            {
                                type: "array",
                                items: [{ const: "type2" }, { type: "number" }]
                            }
                        ]
                    }
                ]
            };
            
            const zodSchema = convertJsonSchemaToZod(schema);
            
            // Both tuple types should work
            expect(zodSchema.parse(["type1", "value"])).toEqual(["type1", "value"]);
            expect(zodSchema.parse(["type2", 123])).toEqual(["type2", 123]);
            
            // Invalid tuples should fail
            expect(() => zodSchema.parse(["type1", 123])).toThrow();
            expect(() => zodSchema.parse(["type2", "value"])).toThrow();
            expect(() => zodSchema.parse(["type3", "value"])).toThrow();
        });
    });
});