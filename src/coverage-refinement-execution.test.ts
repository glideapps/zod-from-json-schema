import { describe, it, expect } from "vitest";
import { convertJsonSchemaToZod } from "./index";
import { z } from "zod/v4";

describe("Refinement Function Execution Coverage", () => {
    describe("String Constraints Refinement Execution", () => {
        it("should execute minLength validation inside refinement", () => {
            const schema = { minLength: 3 };
            const zodSchema = convertJsonSchemaToZod(schema);
            
            // Test with a string that's too short
            const shortResult = zodSchema.safeParse("ab");
            expect(shortResult.success).toBe(false);
            
            // Test with a string that's long enough
            const validResult = zodSchema.safeParse("abc");
            expect(validResult.success).toBe(true);
            
            // Test with non-string (should pass)
            const nonStringResult = zodSchema.safeParse(123);
            expect(nonStringResult.success).toBe(true);
        });

        it("should execute maxLength validation inside refinement", () => {
            const schema = { maxLength: 5 };
            const zodSchema = convertJsonSchemaToZod(schema);
            
            // Test with a string that's too long
            const longResult = zodSchema.safeParse("toolong");
            expect(longResult.success).toBe(false);
            
            // Test with a string that's within limit
            const validResult = zodSchema.safeParse("short");
            expect(validResult.success).toBe(true);
            
            // Test with non-string (should pass)
            const nonStringResult = zodSchema.safeParse([1, 2, 3]);
            expect(nonStringResult.success).toBe(true);
        });

        it("should execute pattern validation inside refinement", () => {
            const schema = { pattern: "^[A-Z]+$" };
            const zodSchema = convertJsonSchemaToZod(schema);
            
            // Test with a string that doesn't match
            const invalidResult = zodSchema.safeParse("lowercase");
            expect(invalidResult.success).toBe(false);
            
            // Test with a string that matches
            const validResult = zodSchema.safeParse("UPPERCASE");
            expect(validResult.success).toBe(true);
            
            // Test with non-string (should pass)
            const nonStringResult = zodSchema.safeParse({ key: "value" });
            expect(nonStringResult.success).toBe(true);
        });

        it("should execute all string constraints together", () => {
            const schema = {
                minLength: 2,
                maxLength: 10, 
                pattern: "^[a-z]+$"
            };
            const zodSchema = convertJsonSchemaToZod(schema);
            
            // Test various failure cases
            expect(zodSchema.safeParse("a").success).toBe(false); // too short
            expect(zodSchema.safeParse("verylongstring").success).toBe(false); // too long
            expect(zodSchema.safeParse("ABC").success).toBe(false); // wrong pattern
            expect(zodSchema.safeParse("12").success).toBe(false); // wrong pattern
            
            // Test success cases
            expect(zodSchema.safeParse("ab").success).toBe(true);
            expect(zodSchema.safeParse("hello").success).toBe(true);
            expect(zodSchema.safeParse("lowercase").success).toBe(true);
            
            // Non-strings should pass
            expect(zodSchema.safeParse(null).success).toBe(true);
            expect(zodSchema.safeParse(false).success).toBe(true);
            expect(zodSchema.safeParse([]).success).toBe(true);
        });
    });

    describe("ArrayItems Coverage", () => {
        it("should handle array items without tuple conversion", () => {
            const schema = {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        id: { type: "number" },
                        name: { type: "string" }
                    },
                    required: ["id", "name"]
                }
            };
            
            const zodSchema = convertJsonSchemaToZod(schema);
            
            const valid = [
                { id: 1, name: "Alice" },
                { id: 2, name: "Bob" }
            ];
            expect(zodSchema.parse(valid)).toEqual(valid);
            
            const invalid = [
                { id: 1, name: "Alice" },
                { id: "2", name: "Bob" } // Wrong type for id
            ];
            expect(() => zodSchema.parse(invalid)).toThrow();
        });
    });

    describe("TupleItems Coverage", () => {
        it("should handle tuple replacement in union types", () => {
            const schema = {
                oneOf: [
                    {
                        type: "array",
                        items: [
                            { type: "string", const: "TYPE_A" },
                            { type: "object", properties: { value: { type: "number" } } }
                        ]
                    },
                    {
                        type: "array",
                        items: [
                            { type: "string", const: "TYPE_B" },
                            { type: "string" }
                        ]
                    }
                ]
            };
            
            const zodSchema = convertJsonSchemaToZod(schema);
            
            // Test first tuple type
            expect(zodSchema.parse(["TYPE_A", { value: 42 }])).toEqual(["TYPE_A", { value: 42 }]);
            
            // Test second tuple type
            expect(zodSchema.parse(["TYPE_B", "hello"])).toEqual(["TYPE_B", "hello"]);
            
            // Test invalid tuples
            expect(() => zodSchema.parse(["TYPE_A", "wrong"])).toThrow();
            expect(() => zodSchema.parse(["TYPE_C", "invalid"])).toThrow();
        });

        it("should return unchanged for non-tuple schemas", () => {
            const schema = {
                type: "string",
                minLength: 5
            };
            
            const zodSchema = convertJsonSchemaToZod(schema);
            expect(zodSchema.parse("hello")).toBe("hello");
            expect(() => zodSchema.parse("hi")).toThrow();
        });
    });

    describe("EnumComplex Coverage", () => {
        it("should skip refinement for primitive enum values", () => {
            const schema = {
                enum: [1, 2, 3, "a", "b", "c", true, false, null]
            };
            
            const zodSchema = convertJsonSchemaToZod(schema);
            
            // All primitives should pass without complex validation
            expect(zodSchema.parse(1)).toBe(1);
            expect(zodSchema.parse("a")).toBe("a");
            expect(zodSchema.parse(true)).toBe(true);
            expect(zodSchema.parse(null)).toBe(null);
            
            // Non-enum values should fail
            expect(() => zodSchema.parse(4)).toThrow();
            expect(() => zodSchema.parse("d")).toThrow();
        });
    });
});