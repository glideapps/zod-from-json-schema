import { describe, it, expect } from "vitest";
import { convertJsonSchemaToZod } from "./index";
import { ArrayItemsHandler } from "./handlers/refinement/arrayItems";
import { TupleItemsHandler } from "./handlers/refinement/tupleItems";
import { z } from "zod/v4";

describe("Union Tuple Replacement Coverage", () => {
    describe("ArrayItems edge case", () => {
        it("should handle array items when zodSchema is already ZodArray", () => {
            const handler = new ArrayItemsHandler();
            
            // Create a ZodArray directly
            const existingArray = z.array(z.string());
            
            // Apply handler with items schema
            const result = handler.apply(existingArray, {
                type: "array",
                items: { type: "number", minimum: 0 }
            });
            
            // Should create a new array with the item schema
            expect(result.parse([1, 2, 3])).toEqual([1, 2, 3]);
            expect(() => result.parse([-1])).toThrow();
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

        it("should handle direct application to non-tuple schemas", () => {
            const handler = new TupleItemsHandler();
            
            // Test with various non-tuple schemas
            const schemas = [
                z.string(),
                z.number(),
                z.boolean(),
                z.null(),
                z.object({ a: z.string() }),
                z.literal("test")
            ];
            
            schemas.forEach(schema => {
                const result = handler.apply(schema, { type: "string" });
                expect(result).toBe(schema); // Should return unchanged
            });
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