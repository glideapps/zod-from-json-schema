import { describe, it, expect } from "vitest";
import { convertJsonSchemaToZod } from "./index";
import { z } from "zod/v4";

describe("Final Coverage - ArrayItems and TupleItems", () => {
    describe("ArrayItems lines 71-73", () => {
        it("should handle array schema without tuple conversion", () => {
            // This test ensures we hit the else branch at lines 71-73
            const schema = {
                type: "array",
                items: {
                    type: "string",
                    minLength: 2,
                    maxLength: 10
                },
                minItems: 1,
                maxItems: 5
            };
            
            const zodSchema = convertJsonSchemaToZod(schema);
            
            // Valid arrays
            expect(zodSchema.parse(["ab", "hello", "world"])).toEqual(["ab", "hello", "world"]);
            expect(zodSchema.parse(["test"])).toEqual(["test"]);
            
            // Invalid arrays
            expect(() => zodSchema.parse([])).toThrow(); // too few items
            expect(() => zodSchema.parse(["a"])).toThrow(); // string too short
            expect(() => zodSchema.parse(["ab", "cd", "ef", "gh", "ij", "kl"])).toThrow(); // too many items
        });

        it("should handle complex nested array items", () => {
            const schema = {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        type: { enum: ["A", "B", "C"] },
                        value: { type: "number", minimum: 0 }
                    },
                    required: ["type", "value"]
                }
            };
            
            const zodSchema = convertJsonSchemaToZod(schema);
            
            const valid = [
                { type: "A", value: 10 },
                { type: "B", value: 20 }
            ];
            expect(zodSchema.parse(valid)).toEqual(valid);
            
            const invalid = [
                { type: "D", value: 10 } // Invalid enum value
            ];
            expect(() => zodSchema.parse(invalid)).toThrow();
        });
    });

    describe("TupleItems lines 46-50 and 55", () => {
        it("should handle tuple replacement in deeply nested unions", () => {
            // This test targets the union replacement logic at lines 46-50
            const schema = {
                allOf: [
                    {
                        anyOf: [
                            {
                                type: "array",
                                items: [
                                    { const: "event" },
                                    { type: "string" },
                                    { type: "object" }
                                ]
                            },
                            { type: "null" }
                        ]
                    }
                ]
            };
            
            const zodSchema = convertJsonSchemaToZod(schema);
            
            // Test tuple
            expect(zodSchema.parse(["event", "click", { x: 10, y: 20 }])).toEqual(["event", "click", { x: 10, y: 20 }]);
            
            // Test null alternative
            expect(zodSchema.parse(null)).toBe(null);
            
            // Test invalid tuple
            expect(() => zodSchema.parse(["notEvent", "click", {}])).toThrow();
        });

        it("should handle non-tuple schemas unchanged (line 55)", () => {
            // This test ensures we hit the final return at line 55
            const schemas = [
                { type: "string" },
                { type: "number" },
                { type: "boolean" },
                { type: "null" },
                { type: "object", properties: { a: { type: "string" } } },
                { enum: [1, 2, 3] },
                { const: "fixed" }
            ];
            
            schemas.forEach(schema => {
                const zodSchema = convertJsonSchemaToZod(schema);
                // Just verify they convert without error
                expect(zodSchema).toBeDefined();
            });
        });

        it("should handle intersection with tuple replacement", () => {
            // Another test for the union replacement logic
            const schema = {
                oneOf: [
                    {
                        allOf: [
                            {
                                type: "array",
                                items: [
                                    { type: "number", minimum: 0 },
                                    { type: "number", maximum: 100 }
                                ]
                            },
                            {
                                type: "array",
                                minItems: 2,
                                maxItems: 2
                            }
                        ]
                    },
                    {
                        type: "string",
                        pattern: "^none$"
                    }
                ]
            };
            
            const zodSchema = convertJsonSchemaToZod(schema);
            
            // Test valid tuple
            expect(zodSchema.parse([5, 95])).toEqual([5, 95]);
            
            // Test string alternative
            expect(zodSchema.parse("none")).toBe("none");
            
            // Test invalid values
            expect(() => zodSchema.parse([-1, 50])).toThrow(); // negative number
            expect(() => zodSchema.parse([50, 101])).toThrow(); // over maximum
            expect(() => zodSchema.parse("other")).toThrow(); // wrong pattern
        });
    });
});