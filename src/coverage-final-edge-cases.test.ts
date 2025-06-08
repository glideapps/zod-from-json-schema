import { describe, it, expect } from "vitest";
import { convertJsonSchemaToZod } from "./index";
import { z } from "zod/v4";

describe("Final Edge Cases Coverage", () => {
    describe("ArrayItems lines 71-73 - force execution", () => {
        it("should trigger arrayItems lines 71-73 through converter", () => {
            // This test is designed to hit a very specific edge case in ArrayItemsHandler
            // where we have array items that need conversion but the zodSchema is already a ZodArray
            const schema = {
                type: "array",
                minItems: 1, // This creates an initial array schema
                maxItems: 5, // This modifies the existing array schema
                items: {     // This should trigger the arrayItems handler lines 71-73
                    type: "object",
                    properties: {
                        value: { type: "number", minimum: 0 }
                    },
                    required: ["value"]
                }
            };
            
            const zodSchema = convertJsonSchemaToZod(schema);
            
            // Test that it works correctly
            expect(zodSchema.parse([{ value: 10 }])).toEqual([{ value: 10 }]);
            expect(() => zodSchema.parse([])).toThrow(); // minItems
            expect(() => zodSchema.parse([{ value: -1 }])).toThrow(); // minimum
        });

        it("should handle array with boolean items through converter", () => {
            // Test boolean items schemas
            const schema1 = {
                type: "array",
                items: false // No additional items allowed
            };
            
            const zodSchema1 = convertJsonSchemaToZod(schema1);
            expect(zodSchema1.parse([])).toEqual([]);
            
            const schema2 = {
                type: "array", 
                items: true // Any additional items allowed
            };
            
            const zodSchema2 = convertJsonSchemaToZod(schema2);
            expect(zodSchema2.parse([1, "string", true])).toEqual([1, "string", true]);
        });
    });

    describe("TupleItems line 55 - return unchanged", () => {
        it("should handle non-tuple schemas through converter", () => {
            // Test various schemas that should go through TupleItemsHandler but not trigger tuple conversion
            const schemas = [
                { type: "string" },
                { type: "number" },
                { type: "boolean" },
                { type: "null" },
                { type: "object", properties: { a: { type: "string" } } },
                { const: "literal_value" },
                { enum: ["a", "b", "c"] },
            ];
            
            schemas.forEach(schema => {
                const zodSchema = convertJsonSchemaToZod(schema);
                expect(zodSchema).toBeDefined();
            });
        });

        it("should handle complex schemas through converter", () => {
            // Test complex schemas that should trigger the TupleItemsHandler line 55 return
            const complexSchemas = [
                {
                    type: "object",
                    properties: {
                        nested: {
                            type: "object", 
                            properties: {
                                deep: { type: "string" }
                            }
                        }
                    }
                },
                {
                    type: "array",
                    items: { type: "string" } // Not tuple items
                },
                {
                    allOf: [
                        { type: "string" },
                        { minLength: 5 }
                    ]
                }
            ];
            
            complexSchemas.forEach(schema => {
                const zodSchema = convertJsonSchemaToZod(schema);
                expect(zodSchema).toBeDefined();
            });
        });
    });

    describe("Force remaining edge cases", () => {
        it("should handle specific scenarios for remaining lines", () => {
            // Test a schema that might trigger the remaining uncovered lines
            const schema = {
                type: "array",
                minItems: 1,
                items: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        age: { type: "number", minimum: 0 }
                    },
                    required: ["name"]
                }
            };
            
            const zodSchema = convertJsonSchemaToZod(schema);
            
            // Test valid case
            expect(zodSchema.parse([{ name: "Alice", age: 30 }])).toEqual([{ name: "Alice", age: 30 }]);
            
            // Test invalid cases
            expect(() => zodSchema.parse([])).toThrow(); // minItems
            expect(() => zodSchema.parse([{ age: 30 }])).toThrow(); // missing name
        });
    });
});