import { describe, it, expect } from "vitest";
import { convertJsonSchemaToZod } from "./index";

describe("Specific Line Coverage", () => {
    // For array.ts line 38-39 (closing brace after types.array assignment in tuple branch)
    it("should cover array handler tuple branch with existing array", () => {
        const schema = {
            type: "array",
            minItems: 1, // Creates types.array first
            maxItems: 10, // Further modifies types.array
            items: [{ type: "string" }, { type: "number" }] // Tuple items
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        expect(() => zodSchema.parse([])).toThrow(); // minItems
        expect(zodSchema.parse(["a", 1])).toEqual(["a", 1]);
    });

    // For tuple.ts line 16 (early return when types.array is false)
    it("should skip tuple processing when array type is false", () => {
        const schema = {
            const: 42, // ConstHandler sets all types including array to false
            items: [{ type: "string" }] // TupleHandler should skip this
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        expect(zodSchema.parse(42)).toBe(42);
        expect(() => zodSchema.parse(["string"])).toThrow();
    });

    // For arrayItems.ts lines 71-73 (simple array items, not tuple)
    it("should process non-tuple array items", () => {
        const schema = {
            type: "array",
            items: { 
                type: "number",
                minimum: 0,
                maximum: 100
            }
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        expect(zodSchema.parse([0, 50, 100])).toEqual([0, 50, 100]);
        expect(() => zodSchema.parse([-1])).toThrow();
        expect(() => zodSchema.parse([101])).toThrow();
    });

    // For enumComplex.ts line 21 (primitive value check)
    it("should pass through primitive enum values without complex validation", () => {
        const schema = {
            enum: ["a", "b", "c", 1, 2, 3, true, false, null]
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        
        // All primitives should work
        expect(zodSchema.parse("a")).toBe("a");
        expect(zodSchema.parse(1)).toBe(1);
        expect(zodSchema.parse(true)).toBe(true);
        expect(zodSchema.parse(null)).toBe(null);
    });

    // For enumNull.ts line 33 (return when not a union)
    it("should handle enum with null when schema is not a union", () => {
        const schema = {
            const: null,
            enum: [null] // Redundant but valid
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        expect(zodSchema.parse(null)).toBe(null);
    });

    // For tupleItems.ts lines 46-50 (union with tuple replacement)
    it("should replace tuple placeholder in complex union", () => {
        const schema = {
            anyOf: [
                {
                    type: "array",
                    items: [
                        { type: "string", minLength: 1 },
                        { type: "number", minimum: 0 }
                    ]
                },
                { type: "boolean" },
                { type: "null" }
            ]
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        expect(zodSchema.parse(["hello", 42])).toEqual(["hello", 42]);
        expect(zodSchema.parse(true)).toBe(true);
        expect(zodSchema.parse(null)).toBe(null);
        expect(() => zodSchema.parse(["", 0])).toThrow(); // minLength
        expect(() => zodSchema.parse(["hello", -1])).toThrow(); // minimum
    });

    // For tupleItems.ts line 55 (non-applicable case)
    it("should return unchanged when schema doesn't involve tuples", () => {
        const schema = {
            type: "object",
            properties: {
                name: { type: "string" }
            }
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        expect(zodSchema.parse({ name: "test" })).toEqual({ name: "test" });
    });
});