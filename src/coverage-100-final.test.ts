import { describe, it, expect, vi } from "vitest";
import { convertJsonSchemaToZod } from "./index";
import { createUniqueItemsValidator } from "./core/utils";

describe("100% Coverage - Final Push", () => {
    // emptyEnum.ts line 11
    it("should create z.never() for empty enum without type", () => {
        const schema = {
            enum: [] // Empty enum without type - should result in z.never()
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        expect(() => zodSchema.parse(1)).toThrow();
        expect(() => zodSchema.parse("test")).toThrow();
        expect(() => zodSchema.parse(null)).toThrow();
    });

    // converter.ts line 132 - proper test for empty allowedSchemas
    it("should create z.never() when type array is empty", () => {
        const schema = {
            type: [] as any[] // Empty type array - all types set to false
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        // z.never() rejects all values
        expect(() => zodSchema.parse("string")).toThrow();
        expect(() => zodSchema.parse(123)).toThrow();
        expect(() => zodSchema.parse(true)).toThrow();
        expect(() => zodSchema.parse(null)).toThrow();
        expect(() => zodSchema.parse([])).toThrow();
        expect(() => zodSchema.parse({})).toThrow();
        expect(() => zodSchema.parse(undefined)).toThrow();
    });

    // converter.ts line 94 - boolean schema false
    it("should create z.never() for boolean schema false", () => {
        const zodSchema = convertJsonSchemaToZod(false);
        // z.never() rejects all values
        expect(() => zodSchema.parse("string")).toThrow();
        expect(() => zodSchema.parse(123)).toThrow();
        expect(() => zodSchema.parse(true)).toThrow();
        expect(() => zodSchema.parse(null)).toThrow();
        expect(() => zodSchema.parse([])).toThrow();
        expect(() => zodSchema.parse({})).toThrow();
        expect(() => zodSchema.parse(undefined)).toThrow();
    });

    // utils.ts lines 10-11
    it("should handle non-array values in uniqueItems", () => {
        const validator = createUniqueItemsValidator();
        expect(validator(42)).toBe(true);
        expect(validator("test")).toBe(true);
    });

    // array.ts lines 38-39 - This seems to be the else branch after tuple check
    it("should create array schema for tuple items when types.array exists", () => {
        const schema = {
            type: "array",
            minItems: 2,
            items: [{ type: "string" }, { type: "number" }] // Tuple with 2 items
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        expect(() => zodSchema.parse(["one"])).toThrow(); // Less than minItems
        expect(zodSchema.parse(["one", 1])).toEqual(["one", 1]);
    });

    // enum.ts line 50 - unreachable defensive code
    // This line cannot be covered as it's a defensive return that's never reached

    // tuple.ts line 16 - branch check
    it("should skip tuple when array is false", () => {
        const schema = {
            type: "boolean", // TypeHandler sets array to false
            items: [{ type: "string" }]
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        expect(zodSchema.parse(true)).toBe(true);
    });

    // arrayItems.ts lines 71-73
    it("should handle simple array items that aren't tuples", () => {
        const schema = {
            type: "array",
            items: {
                type: "string",
                enum: ["a", "b", "c"]
            }
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        expect(zodSchema.parse(["a", "b", "c"])).toEqual(["a", "b", "c"]);
        expect(() => zodSchema.parse(["d"])).toThrow();
    });

    // enumComplex.ts line 21 - primitive check branch
    it("should return true for primitives in enum complex handler", () => {
        const schema = {
            enum: ["test", 123, true, null]
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        expect(zodSchema.parse("test")).toBe("test");
        expect(zodSchema.parse(123)).toBe(123);
    });

    // objectProperties.ts lines 85-86
    it("should reject unknown properties with additionalProperties false", () => {
        const schema = {
            properties: {
                name: { type: "string" }
            },
            additionalProperties: false
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        
        // Valid
        expect(zodSchema.parse({ name: "test" })).toEqual({ name: "test" });
        
        // Invalid - extra property
        expect(() => zodSchema.parse({ name: "test", age: 30 })).toThrow();
    });

    // stringConstraints.ts lines 28-29, 32-33, 38-39
    // These lines are inside the refinement function
    it("should execute all string constraint checks", () => {
        // Force minLength check (lines 28-29)
        const schema1 = { minLength: 10 };
        const zod1 = convertJsonSchemaToZod(schema1);
        const result1 = zod1.safeParse("short");
        expect(result1.success).toBe(false);
        
        // Force maxLength check (lines 32-33)
        const schema2 = { maxLength: 2 };
        const zod2 = convertJsonSchemaToZod(schema2);
        const result2 = zod2.safeParse("toolong");
        expect(result2.success).toBe(false);
        
        // Force pattern check (lines 38-39)
        const schema3 = { pattern: "^[A-Z]+$" };
        const zod3 = convertJsonSchemaToZod(schema3);
        const result3 = zod3.safeParse("lowercase");
        expect(result3.success).toBe(false);
        
        // Verify the refinement actually runs
        expect(zod1.safeParse("this is long enough").success).toBe(true);
        expect(zod2.safeParse("ok").success).toBe(true);
        expect(zod3.safeParse("UPPERCASE").success).toBe(true);
    });

    // tupleItems.ts lines 34-42
    it("should create z.never() for incompatible tuple constraints", () => {
        const schema1 = {
            type: "array",
            items: [{ type: "string" }],
            minItems: 10 // Can't have 10 items in 1-item tuple
        };
        
        const zodSchema1 = convertJsonSchemaToZod(schema1);
        expect(() => zodSchema1.parse(["test"])).toThrow();
        
        const schema2 = {
            type: "array",
            items: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
            maxItems: 1 // Can't have max 1 item in 3-item tuple
        };
        
        const zodSchema2 = convertJsonSchemaToZod(schema2);
        expect(() => zodSchema2.parse(["test", 1, true])).toThrow();
    });

    // tupleItems.ts lines 46-50
    it("should handle tuple in union by replacing placeholder", () => {
        const schema = {
            anyOf: [
                {
                    type: "array",
                    items: [{ const: "A" }, { const: "B" }]
                },
                { type: "null" }
            ]
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        expect(zodSchema.parse(["A", "B"])).toEqual(["A", "B"]);
        expect(zodSchema.parse(null)).toBe(null);
    });

    // tupleItems.ts line 55
    it("should return unchanged when not tuple", () => {
        const schema = {
            const: "fixed"
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        expect(zodSchema.parse("fixed")).toBe("fixed");
    });
});