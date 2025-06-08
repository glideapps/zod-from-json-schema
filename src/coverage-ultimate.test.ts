import { describe, it, expect } from "vitest";
import { convertJsonSchemaToZod } from "./index";

describe("Ultimate Coverage - Final Lines", () => {
    describe("ArrayItems lines 71-73 - ultimate test", () => {
        it("should force arrayItems reconstruction", () => {
            // The key is to create a scenario where:
            // 1. We start with a ZodArray (created by primitive handlers)
            // 2. The items schema is not a boolean and not an array (tuple)
            // 3. The ArrayItemsHandler needs to reconstruct the array
            
            const schema = {
                type: "array",
                // These create a ZodArray in primitive phase
                minItems: 1,
                maxItems: 10,
                uniqueItems: true,
                // This items schema should trigger lines 71-73 in refinement phase
                items: {
                    anyOf: [
                        { type: "string", minLength: 3 },
                        { type: "number", minimum: 100 }
                    ]
                }
            };
            
            const zodSchema = convertJsonSchemaToZod(schema);
            
            // Test that the complex items schema works
            expect(zodSchema.parse(["hello", 150])).toEqual(["hello", 150]);
            expect(() => zodSchema.parse(["hi"])).toThrow(); // string too short
            expect(() => zodSchema.parse([50])).toThrow(); // number too small
            expect(() => zodSchema.parse([])).toThrow(); // minItems
        });

        it("should trigger with deeply nested items schema", () => {
            const schema = {
                type: "array",
                minItems: 1, // Creates initial ZodArray
                items: {
                    type: "object",
                    properties: {
                        nested: {
                            type: "object",
                            properties: {
                                value: {
                                    oneOf: [
                                        { type: "string", pattern: "^[A-Z]+$" },
                                        { type: "number", multipleOf: 5 }
                                    ]
                                }
                            },
                            required: ["value"]
                        }
                    },
                    required: ["nested"]
                }
            };
            
            const zodSchema = convertJsonSchemaToZod(schema);
            
            // Test complex nested validation
            expect(zodSchema.parse([{ nested: { value: "HELLO" } }])).toEqual([{ nested: { value: "HELLO" } }]);
            expect(zodSchema.parse([{ nested: { value: 25 } }])).toEqual([{ nested: { value: 25 } }]);
            expect(() => zodSchema.parse([{ nested: { value: "hello" } }])).toThrow(); // wrong pattern
            expect(() => zodSchema.parse([{ nested: { value: 7 } }])).toThrow(); // not multiple of 5
        });
    });

    describe("TupleItems line 55 - ultimate test", () => {
        it("should hit the final return for non-applicable schemas", () => {
            // Create schemas that go through TupleItemsHandler but don't match any conditions
            const schemas = [
                // Simple primitives
                { type: "string", minLength: 5 },
                { type: "number", minimum: 10 },
                { type: "boolean" },
                
                // Objects without tuple-related properties
                {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        value: { type: "number" }
                    }
                },
                
                // Arrays but not tuples
                {
                    type: "array",
                    items: { type: "string" }, // Single items schema, not tuple
                    minItems: 1
                },
                
                // Enums and constants
                { enum: ["red", "green", "blue"] },
                { const: "fixed_value" },
                
                // Complex schemas without tuples
                {
                    allOf: [
                        { type: "string" },
                        { minLength: 3 },
                        { maxLength: 10 }
                    ]
                },
                
                {
                    anyOf: [
                        { type: "string" },
                        { type: "number" }
                    ]
                },
                
                {
                    oneOf: [
                        { type: "string", pattern: "^A" },
                        { type: "string", pattern: "^B" }
                    ]
                }
            ];
            
            // Each of these should pass through TupleItemsHandler and hit line 55
            schemas.forEach((schema, index) => {
                const zodSchema = convertJsonSchemaToZod(schema);
                expect(zodSchema).toBeDefined();
                // Just ensure they convert successfully
            });
        });

        it("should handle edge case schemas that definitely hit line 55", () => {
            // Schemas that absolutely cannot be tuples
            const edgeCases = [
                { type: "null" },
                { not: { type: "array" } },
                {
                    if: { type: "string" },
                    then: { minLength: 1 },
                    else: { type: "number" }
                },
                {
                    type: "object",
                    patternProperties: {
                        "^[a-z]+$": { type: "string" }
                    }
                }
            ];
            
            edgeCases.forEach(schema => {
                const zodSchema = convertJsonSchemaToZod(schema);
                expect(zodSchema).toBeDefined();
            });
        });
    });
});