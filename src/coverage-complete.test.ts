import { describe, it, expect } from "vitest";
import { z } from "zod/v4";
import { convertJsonSchemaToZod } from "./index";
import { createUniqueItemsValidator } from "./core/utils";

describe("Complete Coverage Tests", () => {
    // converter.ts line 132 - z.never() when no types allowed
    it("should create z.never() when all types are disallowed", () => {
        // This creates a case where all types are false
        const schema = {
            type: ["string", "number"],
            const: { complex: "object" }  // const with incompatible type
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        expect(() => zodSchema.parse("anything")).toThrow();
        expect(() => zodSchema.parse(123)).toThrow();
        expect(() => zodSchema.parse({ complex: "object" })).toThrow();
    });

    // utils.ts lines 10-11 - non-array in uniqueItems validator
    it("should handle non-array values in uniqueItems validator", () => {
        const validator = createUniqueItemsValidator();
        expect(validator("not array")).toBe(true);
        expect(validator(null)).toBe(true);
    });

    // stringConstraints lines 28-29, 32-33, 38-39 - all failures
    it("should fail string constraints without type", () => {
        const schema1 = { minLength: 5 };
        const zod1 = convertJsonSchemaToZod(schema1);
        expect(() => zod1.parse("ab")).toThrow();

        const schema2 = { maxLength: 2 };
        const zod2 = convertJsonSchemaToZod(schema2);
        expect(() => zod2.parse("abc")).toThrow();

        const schema3 = { pattern: "^[0-9]+$" };
        const zod3 = convertJsonSchemaToZod(schema3);
        expect(() => zod3.parse("abc")).toThrow();
    });

    // enumNull.ts line 33 - null not in enum values
    it("should handle type with null but enum without null", () => {
        const schema = {
            type: ["string", "null"],
            enum: ["test"]  // null is not in enum
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        expect(zodSchema.parse("test")).toBe("test");
        expect(() => zodSchema.parse(null)).toThrow();
    });

    // objectProperties lines 85-86 - additional properties check
    it("should validate additionalProperties false", () => {
        const schema = {
            // No explicit type
            properties: {
                allowed: { type: "string" }
            },
            additionalProperties: false
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        expect(() => zodSchema.parse({ allowed: "yes", extra: "no" })).toThrow();
    });

    // tupleItems lines 34-42 - minItems/maxItems constraints
    it("should handle tuple with invalid minItems", () => {
        const schema = {
            type: "array",
            items: [{ type: "string" }],
            minItems: 5  // Can't satisfy with 1-item tuple
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        expect(() => zodSchema.parse(["hello"])).toThrow();
    });

    it("should handle tuple with invalid maxItems", () => {
        const schema = {
            type: "array",
            items: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
            maxItems: 2  // Can't satisfy with 3-item tuple
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        expect(() => zodSchema.parse(["hello", 42, true])).toThrow();
    });

    // tupleItems lines 46-50 - union handling
    it("should handle tuple in union by replacing placeholder", () => {
        const schema = {
            anyOf: [
                {
                    type: "array",
                    items: [{ const: "fixed" }]
                },
                { type: "boolean" }
            ]
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        expect(zodSchema.parse(["fixed"])).toEqual(["fixed"]);
        expect(zodSchema.parse(true)).toBe(true);
    });

    // tupleItems line 55 - return unchanged
    it("should return unchanged when not applicable", () => {
        const schema = {
            type: "object",
            properties: {}
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        expect(zodSchema.parse({})).toEqual({});
    });
});