import { describe, it, expect } from "vitest";
import { convertJsonSchemaToZod, jsonSchemaObjectToZodRawShape } from "./index";
import { z } from "zod/v4";
import { JSONSchema } from "zod/v4/core";

describe("convertJsonSchemaToZod", () => {
    it("should correctly convert a schema with additionalProperties: {}", () => {
        // Define a simple JSON schema
        const jsonSchema: JSONSchema.BaseSchema = {
            $schema: "https://json-schema.org/draft/2020-12/schema",
            type: "object",
            properties: {
                name: { type: "string" },
                age: { type: "integer", minimum: -43, maximum: 120 },
                isActive: { type: "boolean" },
            },
            required: ["name", "age"],
            additionalProperties: {},
        };

        // Convert JSON schema to Zod
        const zodSchema = convertJsonSchemaToZod(jsonSchema);

        // Convert Zod schema back to JSON schema
        const resultSchema = z.toJSONSchema(zodSchema);

        // Compare the original and resulting schemas
        expect(resultSchema).toEqual(jsonSchema);
    });

    it("should correctly convert a schema with additionalProperties: false", () => {
        // Define a JSON schema with additionalProperties: false
        const jsonSchema: JSONSchema.BaseSchema = {
            $schema: "https://json-schema.org/draft/2020-12/schema",
            type: "object",
            properties: {
                name: { type: "string" },
                age: { type: "integer", minimum: 0, maximum: 120 },
            },
            required: ["name"],
            additionalProperties: false,
        };

        // Convert JSON schema to Zod
        const zodSchema = convertJsonSchemaToZod(jsonSchema);

        // Convert Zod schema back to JSON schema
        const resultSchema = z.toJSONSchema(zodSchema);

        // Compare the original and resulting schemas
        expect(resultSchema).toEqual(jsonSchema);
    });

    it("should correctly convert a schema with array type", () => {
        const jsonSchema: JSONSchema.BaseSchema = {
            $schema: "https://json-schema.org/draft/2020-12/schema",
            type: "array",
            items: {
                type: "string",
            },
        };

        const zodSchema = convertJsonSchemaToZod(jsonSchema);
        const resultSchema = z.toJSONSchema(zodSchema);
        expect(resultSchema).toEqual(jsonSchema);
    });

    describe("Enum handling", () => {
        it("should correctly convert a schema with string enum (no type)", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                enum: ["red", "green", "blue"],
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);
            const resultSchema = z.toJSONSchema(zodSchema);

            // For enums, we just check that the original enum values are present
            expect(resultSchema.enum).toEqual(jsonSchema.enum);
        });

        it("should correctly convert a schema with number enum (no type)", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                enum: [1, 2, 3],
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Test validation
            expect(() => zodSchema.parse(1)).not.toThrow();
            expect(() => zodSchema.parse(4)).toThrow();

            const resultSchema = z.toJSONSchema(zodSchema);
            // Zod v4 converts unions to anyOf instead of enum
            expect(resultSchema.anyOf).toEqual([
                { type: "number", const: 1 },
                { type: "number", const: 2 },
                { type: "number", const: 3 },
            ]);
        });

        it("should correctly convert a schema with boolean enum (no type)", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                enum: [true, false],
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Test validation
            expect(() => zodSchema.parse(true)).not.toThrow();
            expect(() => zodSchema.parse(false)).not.toThrow();
            expect(() => zodSchema.parse("true")).toThrow();

            const resultSchema = z.toJSONSchema(zodSchema);
            // Zod v4 converts unions to anyOf instead of enum
            expect(resultSchema.anyOf).toEqual([
                { type: "boolean", const: true },
                { type: "boolean", const: false },
            ]);
        });

        it("should correctly convert a schema with mixed enum (no type)", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                enum: ["red", 1, true, null],
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Test validation
            expect(() => zodSchema.parse("red")).not.toThrow();
            expect(() => zodSchema.parse(1)).not.toThrow();
            expect(() => zodSchema.parse(true)).not.toThrow();
            expect(() => zodSchema.parse(null)).not.toThrow();
            expect(() => zodSchema.parse("blue")).toThrow();
            expect(() => zodSchema.parse(2)).toThrow();

            const resultSchema = z.toJSONSchema(zodSchema);
            // Zod v4 converts unions to anyOf instead of enum
            expect(resultSchema.anyOf).toEqual([
                { type: "string", const: "red" },
                { type: "number", const: 1 },
                { type: "boolean", const: true },
                { type: "null" },
            ]);
        });

        it("should correctly convert a schema with single item mixed enum (no type)", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                enum: [42], // Single non-string value
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Test validation
            expect(() => zodSchema.parse(42)).not.toThrow();
            expect(() => zodSchema.parse(43)).toThrow();
            expect(() => zodSchema.parse("42")).toThrow();

            // Should be represented as a literal in the schema
            const resultSchema = z.toJSONSchema(zodSchema);
            expect(resultSchema.const).toEqual(42);
        });

        it("should handle empty enum case (no type)", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                enum: [], // Empty enum
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Empty enum without type should match nothing (z.never)
            expect(() => zodSchema.parse(42)).toThrow();
            expect(() => zodSchema.parse("anything")).toThrow();
            expect(() => zodSchema.parse(null)).toThrow();
            expect(() => zodSchema.parse({})).toThrow();
        });

        it("should correctly convert a schema with string type and enum", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "string",
                enum: ["red", "green", "blue"],
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Test validation
            expect(() => zodSchema.parse("red")).not.toThrow();
            expect(() => zodSchema.parse("yellow")).toThrow();

            const resultSchema = z.toJSONSchema(zodSchema);
            // For string enums, zod v4 preserves enum format but may omit type
            expect(resultSchema.enum).toEqual(jsonSchema.enum);
        });

        it("should handle empty string enum (with type)", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "string",
                enum: [], // Empty enum
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Empty enum with string type should still validate as a string
            expect(() => zodSchema.parse("any string")).not.toThrow();

            const resultSchema = z.toJSONSchema(zodSchema);
            expect(resultSchema.type).toEqual("string");
        });

        it("should correctly convert a schema with number type and enum", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "number",
                enum: [1, 2, 3],
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Test validation
            expect(() => zodSchema.parse(1)).not.toThrow();
            expect(() => zodSchema.parse(4)).toThrow();

            const resultSchema = z.toJSONSchema(zodSchema);
            // For number enums, zod v4 may represent as anyOf instead
            expect(resultSchema.enum || resultSchema.anyOf).toBeDefined();
        });

        it("should correctly convert a schema with number type and single-item enum", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "number",
                enum: [42],
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Test validation
            expect(() => zodSchema.parse(42)).not.toThrow();
            expect(() => zodSchema.parse(43)).toThrow();

            const resultSchema = z.toJSONSchema(zodSchema);
            expect(resultSchema.const).toEqual(42);
        });

        it("should correctly convert a schema with boolean type and single-item enum", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "boolean",
                enum: [true],
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Test validation
            expect(() => zodSchema.parse(true)).not.toThrow();
            expect(() => zodSchema.parse(false)).toThrow();

            // With our current implementation, single-item enums are converted to literals
            // so zod-to-json-schema might represent it differently than the original.
            // We only check that the schema correctly validates values, not its exact representation
            const resultSchema = z.toJSONSchema(zodSchema);
            // For boolean enums, zod v4 may use different representation
            expect(resultSchema.const || resultSchema.enum || resultSchema.anyOf).toBeDefined();
        });

        it("should correctly convert a schema with boolean type and multiple-item enum", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "boolean",
                enum: [true, false],
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Test validation - should accept both true and false since both are in the enum
            expect(() => zodSchema.parse(true)).not.toThrow();
            expect(() => zodSchema.parse(false)).not.toThrow();

            const resultSchema = z.toJSONSchema(zodSchema);
            // For boolean enums, zod v4 may use different representation
            expect(resultSchema.const || resultSchema.enum || resultSchema.anyOf).toBeDefined();
        });

        it("should handle empty number enum (with type)", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "number",
                enum: [], // Empty enum
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Empty enum with type should still be a valid schema
            expect(() => zodSchema.parse(42)).not.toThrow();

            const resultSchema = z.toJSONSchema(zodSchema);
            expect(resultSchema.type).toEqual("number");
        });

        it("should handle empty boolean enum (with type)", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "boolean",
                enum: [], // Empty enum
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Empty enum with type should still be a valid schema
            expect(() => zodSchema.parse(true)).not.toThrow();
            expect(() => zodSchema.parse(false)).not.toThrow();

            const resultSchema = z.toJSONSchema(zodSchema);
            expect(resultSchema.type).toEqual("boolean");
        });
    });

    describe("Const value handling", () => {
        it("should correctly handle string const values", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                const: "fixed value",
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            expect(() => zodSchema.parse("fixed value")).not.toThrow();
            expect(() => zodSchema.parse("other value")).toThrow();

            const resultSchema = z.toJSONSchema(zodSchema);
            expect(resultSchema.const).toEqual(jsonSchema.const);
        });

        it("should correctly handle number const values", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                const: 42,
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            expect(() => zodSchema.parse(42)).not.toThrow();
            expect(() => zodSchema.parse(43)).toThrow();

            const resultSchema = z.toJSONSchema(zodSchema);
            expect(resultSchema.const).toEqual(jsonSchema.const);
        });

        it("should correctly handle boolean const values", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                const: true,
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            expect(() => zodSchema.parse(true)).not.toThrow();
            expect(() => zodSchema.parse(false)).toThrow();

            const resultSchema = z.toJSONSchema(zodSchema);
            expect(resultSchema.const).toEqual(jsonSchema.const);
        });

        it("should correctly handle null const values", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                const: null,
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            expect(() => zodSchema.parse(null)).not.toThrow();
            expect(() => zodSchema.parse(undefined)).toThrow();

            // Just verify the schema works, not the exact representation
            const resultSchema = z.toJSONSchema(zodSchema);
            expect(resultSchema.type).toEqual("null");
        });

        it("should handle object const values", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                // @ts-expect-error: @TODO: Resolve, for some reason, the spec and the schema do not align on this
                const: { key: "value" },
            };

            // Note: Since the implementation uses a literal comparison,
            // we need to understand that z.literal() with objects does deep equality checks
            // and is actually very strict
            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Create an exact clone of the expected object
            const exactClone = JSON.parse(JSON.stringify({ key: "value" }));

            // With deep equality implementation, exact clones should pass
            expect(() => zodSchema.parse(exactClone)).not.toThrow();
            expect(() => zodSchema.parse({ key: "value" })).not.toThrow();
            expect(() => zodSchema.parse({ key: "other" })).toThrow();
        });

        it("should handle array const values", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                // @ts-expect-error: @TODO: Resolve, for some reason, the spec and the schema do not align on this
                const: [1, 2, 3],
            };

            // Note: Since the implementation uses a literal comparison,
            // we need to understand that z.literal() with arrays does deep equality checks
            // and is actually very strict
            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Create an exact clone of the expected array
            const exactClone = JSON.parse(JSON.stringify([1, 2, 3]));

            // With deep equality implementation, exact clones should pass
            expect(() => zodSchema.parse(exactClone)).not.toThrow();
            expect(() => zodSchema.parse([1, 2, 3])).not.toThrow();
            expect(() => zodSchema.parse([1, 2])).toThrow();
        });
    });

    describe("Combination schemas", () => {
        it("should correctly handle anyOf", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                anyOf: [{ type: "string" }, { type: "number" }],
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Just test the validation behavior
            expect(() => zodSchema.parse("test")).not.toThrow();
            expect(() => zodSchema.parse(42)).not.toThrow();
            expect(() => zodSchema.parse(true)).toThrow();
        });

        it("should correctly handle allOf", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                allOf: [
                    {
                        type: "object",
                        properties: {
                            name: { type: "string" },
                        },
                        required: ["name"],
                    },
                    {
                        type: "object",
                        properties: {
                            age: { type: "number" },
                        },
                        required: ["age"],
                    },
                ],
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Just test validation behavior, not schema representation
            expect(() => zodSchema.parse({ name: "John", age: 30 })).not.toThrow();
            expect(() => zodSchema.parse({ name: "John" })).toThrow();
            expect(() => zodSchema.parse({ age: 30 })).toThrow();
        });

        it("should correctly handle oneOf", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                oneOf: [{ type: "string" }, { type: "number" }],
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Just test the validation behavior, not schema representation
            expect(() => zodSchema.parse("test")).not.toThrow();
            expect(() => zodSchema.parse(42)).not.toThrow();
            expect(() => zodSchema.parse(true)).toThrow();
        });
    });

    describe("Edge cases", () => {
        it("should handle null type schema", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "null",
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            expect(() => zodSchema.parse(null)).not.toThrow();
            expect(() => zodSchema.parse(undefined)).toThrow();
            expect(() => zodSchema.parse("null")).toThrow();

            const resultSchema = z.toJSONSchema(zodSchema);
            expect(resultSchema.type).toEqual("null");
        });

        it("should handle empty object schema with no properties", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "object",
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            expect(() => zodSchema.parse({})).not.toThrow();
            expect(() => zodSchema.parse({ extra: "prop" })).not.toThrow(); // By default additionalProperties is true

            // Arrays should be rejected for explicit object type
            expect(() => zodSchema.parse([])).toThrow();

            // Note: Custom object schemas can't be round-tripped to JSON Schema
            // This is expected behavior as z.custom() types are not representable in JSON Schema
        });

        it("should handle array schema with no items", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "array",
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            expect(() => zodSchema.parse([])).not.toThrow();
            expect(() => zodSchema.parse([1, "string", true])).not.toThrow(); // No items means any items allowed

            const resultSchema = z.toJSONSchema(zodSchema);
            expect(resultSchema.type).toEqual("array");
        });

        it("should return z.any() for empty schema", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // z.any() accepts anything
            expect(() => zodSchema.parse(42)).not.toThrow();
            expect(() => zodSchema.parse("test")).not.toThrow();
            expect(() => zodSchema.parse(null)).not.toThrow();
            expect(() => zodSchema.parse({})).not.toThrow();

            const resultSchema = z.toJSONSchema(zodSchema);
            // zod v4 uses draft 2020-12, not draft-07
            expect(resultSchema.$schema).toBeDefined();
        });

        it("should add description to schema", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "string",
                description: "A test description",
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);
            const resultSchema = z.toJSONSchema(zodSchema);

            expect(resultSchema.description).toEqual(jsonSchema.description);
        });
    });

    describe("File schemas", () => {
        it("should handle basic file schema", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "string",
                format: "binary",
                contentEncoding: "binary",
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Verify it's actually a ZodFile schema
            expect(zodSchema instanceof z.ZodFile).toBe(true);

            const resultSchema = z.toJSONSchema(zodSchema);
            expect(resultSchema).toEqual(jsonSchema);
        });

        it("should handle file schema with size constraints", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "string",
                format: "binary",
                contentEncoding: "binary",
                minLength: 1,
                maxLength: 1048576, // 1MB
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Verify it's actually a ZodFile schema
            expect(zodSchema instanceof z.ZodFile).toBe(true);

            const resultSchema = z.toJSONSchema(zodSchema);
            expect(resultSchema).toEqual(jsonSchema);
        });

        it("should handle file schema with MIME type constraint", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "string",
                format: "binary",
                contentEncoding: "binary",
                contentMediaType: "image/png",
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Verify it's actually a ZodFile schema
            expect(zodSchema instanceof z.ZodFile).toBe(true);

            const resultSchema = z.toJSONSchema(zodSchema);
            expect(resultSchema).toEqual(jsonSchema);
        });

        it("should handle file schema with all constraints", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "string",
                format: "binary",
                contentEncoding: "binary",
                contentMediaType: "image/png",
                minLength: 1,
                maxLength: 1048576,
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Verify it's actually a ZodFile schema with all constraints
            expect(zodSchema instanceof z.ZodFile).toBe(true);

            const resultSchema = z.toJSONSchema(zodSchema);
            expect(resultSchema).toEqual(jsonSchema);
        });

        it("should not treat regular string as file schema", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "string",
                format: "binary",
                // Missing contentEncoding: "binary"
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Verify it's NOT a ZodFile schema, should be ZodString
            expect(zodSchema instanceof z.ZodFile).toBe(false);
            expect(zodSchema instanceof z.ZodString).toBe(true);

            const resultSchema = z.toJSONSchema(zodSchema);

            // Should be treated as a regular string, not a file
            // Note: Zod doesn't preserve format hints for basic strings
            expect(resultSchema.type).toEqual("string");
            expect(resultSchema.contentEncoding).toBeUndefined();
        });

        it("should handle file schema with description", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "string",
                format: "binary",
                contentEncoding: "binary",
                contentMediaType: "application/pdf",
                description: "PDF document upload",
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Verify it's actually a ZodFile schema
            expect(zodSchema instanceof z.ZodFile).toBe(true);

            const resultSchema = z.toJSONSchema(zodSchema);
            expect(resultSchema).toEqual(jsonSchema);
        });
    });

    // Tests for unimplemented but supported features
    describe("String validation", () => {
        it("should support minLength and maxLength constraints", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "string",
                minLength: 3,
                maxLength: 10,
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Test that the validation works correctly
            expect(zodSchema.safeParse("hello").success).toBe(true); // 5 chars, within range
            expect(zodSchema.safeParse("hi").success).toBe(false); // 2 chars, too short
            expect(zodSchema.safeParse("this is too long").success).toBe(false); // too long

            // Test Unicode support
            expect(zodSchema.safeParse("💩💩💩").success).toBe(true); // 3 graphemes
            expect(zodSchema.safeParse("💩").success).toBe(false); // 1 grapheme, too short

            // Note: length constraints implemented with .refine() don't round-trip
            // back to JSON Schema, so we only test the validation behavior
            const resultSchema = z.toJSONSchema(zodSchema);
            expect(resultSchema.type).toBe("string");
        });

        it("should support pattern constraint", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "string",
                pattern: "^[a-zA-Z0-9]+$",
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);
            const resultSchema = z.toJSONSchema(zodSchema);
            expect(resultSchema).toEqual(jsonSchema);
        });
    });

    describe("Number validation", () => {
        it("should support minimum and maximum constraints", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "number",
                minimum: 0,
                maximum: 100,
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);
            const resultSchema = z.toJSONSchema(zodSchema);
            expect(resultSchema).toEqual(jsonSchema);
        });

        it("should support exclusiveMinimum and exclusiveMaximum constraints", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "number",
                exclusiveMinimum: 0,
                exclusiveMaximum: 100,
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);
            const resultSchema = z.toJSONSchema(zodSchema);
            expect(resultSchema).toEqual(jsonSchema);
        });

        it("should support multipleOf constraint", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "number",
                multipleOf: 5,
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Test that the validation works correctly
            expect(zodSchema.safeParse(10).success).toBe(true);
            expect(zodSchema.safeParse(15).success).toBe(true);
            expect(zodSchema.safeParse(7).success).toBe(false);

            // Note: multipleOf constraints implemented with .refine() don't round-trip
            // back to JSON Schema, so we only test the validation behavior
            const resultSchema = z.toJSONSchema(zodSchema);
            expect(resultSchema.type).toBe("number");
        });
    });

    describe("Array validation", () => {
        it("should support minItems and maxItems constraints", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "array",
                items: {
                    type: "string",
                },
                minItems: 1,
                maxItems: 10,
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);
            const resultSchema = z.toJSONSchema(zodSchema);
            expect(resultSchema).toEqual(jsonSchema);
        });

        it("should support uniqueItems constraint", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "array",
                items: {
                    type: "string",
                },
                uniqueItems: true,
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Unfortunately, zod-to-json-schema doesn't properly translate refinements for uniqueItems
            // So we'll verify the functionality by testing with actual data
            expect(() => zodSchema.parse(["a", "b", "c"])).not.toThrow();
            expect(() => zodSchema.parse(["a", "a", "c"])).toThrow();

            // We can't do the normal round-trip test, so we'll verify key parts of the schema
            const resultSchema = z.toJSONSchema(zodSchema);
            expect(resultSchema.type).toEqual("array");
            expect(resultSchema.items).toEqual({ type: "string" });
        });

        it("should support uniqueItems constraint with object items", () => {
            const jsonSchema: JSONSchema.BaseSchema = {
                $schema: "https://json-schema.org/draft/2020-12/schema",
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        id: { type: "number" },
                        name: { type: "string" },
                    },
                },
                uniqueItems: true,
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema);

            // Test with unique objects
            const uniqueObjects = [
                { id: 1, name: "Alice" },
                { id: 2, name: "Bob" },
                { id: 3, name: "Charlie" },
            ];
            expect(() => zodSchema.parse(uniqueObjects)).not.toThrow();

            // Test with duplicate objects (serialized JSON will be the same)
            const duplicateObjects = [
                { id: 1, name: "Alice" },
                { id: 1, name: "Alice" },
                { id: 3, name: "Charlie" },
            ];
            expect(() => zodSchema.parse(duplicateObjects)).toThrow();
        });

        describe("Tuple arrays (items as array)", () => {
            it("should handle tuple array with different types", () => {
                const jsonSchema: JSONSchema.BaseSchema = {
                    $schema: "https://json-schema.org/draft/2020-12/schema",
                    type: "array",
                    items: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
                };

                const zodSchema = convertJsonSchemaToZod(jsonSchema);

                // Valid tuple should pass
                expect(() => zodSchema.parse(["hello", 42, true])).not.toThrow();

                // Wrong types should fail
                expect(() => zodSchema.parse([42, "hello", true])).toThrow();
                expect(() => zodSchema.parse(["hello", "world", true])).toThrow();

                // Wrong length should fail
                expect(() => zodSchema.parse(["hello", 42])).toThrow();
                expect(() => zodSchema.parse(["hello", 42, true, "extra"])).toThrow();
            });

            it("should handle tuple array with single item type", () => {
                const jsonSchema: JSONSchema.BaseSchema = {
                    $schema: "https://json-schema.org/draft/2020-12/schema",
                    type: "array",
                    items: [{ type: "string" }],
                };

                const zodSchema = convertJsonSchemaToZod(jsonSchema);

                expect(() => zodSchema.parse(["hello"])).not.toThrow();
                expect(() => zodSchema.parse([42])).toThrow();
                expect(() => zodSchema.parse(["hello", "world"])).toThrow();
                expect(() => zodSchema.parse([])).toThrow();
            });

            it("should handle empty tuple array", () => {
                const jsonSchema: JSONSchema.BaseSchema = {
                    $schema: "https://json-schema.org/draft/2020-12/schema",
                    type: "array",
                    items: [],
                };

                const zodSchema = convertJsonSchemaToZod(jsonSchema);

                expect(() => zodSchema.parse([])).not.toThrow();
                expect(() => zodSchema.parse(["anything"])).toThrow();
            });

            it("should handle tuple array with complex item types", () => {
                const jsonSchema: JSONSchema.BaseSchema = {
                    $schema: "https://json-schema.org/draft/2020-12/schema",
                    type: "array",
                    items: [
                        {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                            },
                            required: ["name"],
                        },
                        { type: "number", minimum: 0 },
                        {
                            type: "array",
                            items: { type: "string" },
                        },
                    ],
                };

                const zodSchema = convertJsonSchemaToZod(jsonSchema);

                // Valid tuple should pass
                expect(() => zodSchema.parse([{ name: "John" }, 5, ["a", "b", "c"]])).not.toThrow();

                // Invalid object should fail
                expect(() => zodSchema.parse([{ age: 25 }, 5, ["a", "b", "c"]])).toThrow();

                // Invalid number should fail
                expect(() => zodSchema.parse([{ name: "John" }, -5, ["a", "b", "c"]])).toThrow();

                // Invalid nested array should fail
                expect(() => zodSchema.parse([{ name: "John" }, 5, ["a", 123, "c"]])).toThrow();
            });

            it("should convert tuple to proper JSON schema", () => {
                const jsonSchema: JSONSchema.BaseSchema = {
                    $schema: "https://json-schema.org/draft/2020-12/schema",
                    type: "array",
                    items: [{ type: "string" }, { type: "number" }],
                };

                const zodSchema = convertJsonSchemaToZod(jsonSchema);
                const resultSchema = z.toJSONSchema(zodSchema);

                // Zod converts tuples to use prefixItems (which is correct for draft 2020-12)
                expect(resultSchema.type).toEqual("array");
                expect(resultSchema.prefixItems).toEqual([{ type: "string" }, { type: "number" }]);
            });
        });

        describe("prefixItems (Draft 2020-12 tuples)", () => {
            it("should handle prefixItems with different types", () => {
                const jsonSchema: JSONSchema.BaseSchema = {
                    $schema: "https://json-schema.org/draft/2020-12/schema",
                    type: "array",
                    prefixItems: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
                };

                const zodSchema = convertJsonSchemaToZod(jsonSchema);

                // Valid tuple should pass
                expect(() => zodSchema.parse(["hello", 42, true])).not.toThrow();

                // Wrong types should fail
                expect(() => zodSchema.parse([42, "hello", true])).toThrow();
                expect(() => zodSchema.parse(["hello", "world", true])).toThrow();

                // Partial tuples should be allowed - prefixItems doesn't require all items
                expect(() => zodSchema.parse(["hello"])).not.toThrow();
                expect(() => zodSchema.parse(["hello", 42])).not.toThrow();

                // Additional items should be allowed by default with prefixItems
                expect(() => zodSchema.parse(["hello", 42, true, "extra"])).not.toThrow();
                expect(() => zodSchema.parse(["hello", 42, true, 999, { any: "thing" }])).not.toThrow();
            });

            it("should handle prefixItems with single item type", () => {
                const jsonSchema: JSONSchema.BaseSchema = {
                    $schema: "https://json-schema.org/draft/2020-12/schema",
                    type: "array",
                    prefixItems: [{ type: "string" }],
                };

                const zodSchema = convertJsonSchemaToZod(jsonSchema);

                expect(() => zodSchema.parse(["hello"])).not.toThrow();
                expect(() => zodSchema.parse([42])).toThrow();
                expect(() => zodSchema.parse(["hello", "world"])).not.toThrow(); // extra items allowed
                expect(() => zodSchema.parse([])).not.toThrow(); // empty array is valid - no items required
            });

            it("should handle empty prefixItems array", () => {
                const jsonSchema: JSONSchema.BaseSchema = {
                    $schema: "https://json-schema.org/draft/2020-12/schema",
                    type: "array",
                    prefixItems: [],
                };

                const zodSchema = convertJsonSchemaToZod(jsonSchema);

                expect(() => zodSchema.parse([])).not.toThrow();
                expect(() => zodSchema.parse(["anything"])).not.toThrow(); // extra items allowed with empty prefixItems
                expect(() => zodSchema.parse([1, 2, 3])).not.toThrow();
            });

            it("should handle prefixItems with complex nested types", () => {
                const jsonSchema: JSONSchema.BaseSchema = {
                    $schema: "https://json-schema.org/draft/2020-12/schema",
                    type: "array",
                    prefixItems: [
                        {
                            type: "object",
                            properties: {
                                id: { type: "number" },
                                name: { type: "string" },
                            },
                            required: ["id", "name"],
                        },
                        {
                            type: "array",
                            items: { type: "string" },
                        },
                        { type: "number", minimum: 0, maximum: 100 },
                    ],
                };

                const zodSchema = convertJsonSchemaToZod(jsonSchema);

                // Valid tuple should pass
                expect(() => zodSchema.parse([{ id: 1, name: "Alice" }, ["tag1", "tag2"], 50])).not.toThrow();

                // Invalid object should fail
                expect(() =>
                    zodSchema.parse([
                        { name: "Alice" }, // missing id
                        ["tag1", "tag2"],
                        50,
                    ]),
                ).toThrow();

                // Invalid array should fail
                expect(() =>
                    zodSchema.parse([
                        { id: 1, name: "Alice" },
                        ["tag1", 123], // number in string array
                        50,
                    ]),
                ).toThrow();

                // Invalid number should fail
                expect(() =>
                    zodSchema.parse([
                        { id: 1, name: "Alice" },
                        ["tag1", "tag2"],
                        150, // exceeds maximum
                    ]),
                ).toThrow();
            });

            it("should validate prefixItems behavior correctly", () => {
                const jsonSchema: JSONSchema.BaseSchema = {
                    $schema: "https://json-schema.org/draft/2020-12/schema",
                    type: "array",
                    prefixItems: [{ type: "string" }, { type: "number" }],
                };

                const zodSchema = convertJsonSchemaToZod(jsonSchema);

                // Test the behavior instead of schema round-trip since we use custom validation
                expect(() => zodSchema.parse(["hello", 42])).not.toThrow();
                expect(() => zodSchema.parse(["hello"])).not.toThrow();
                expect(() => zodSchema.parse([])).not.toThrow();
                expect(() => zodSchema.parse(["hello", 42, "extra"])).not.toThrow();
                expect(() => zodSchema.parse([42, "hello"])).toThrow();
            });

            it("should handle prefixItems with constraints", () => {
                const jsonSchema: JSONSchema.BaseSchema = {
                    $schema: "https://json-schema.org/draft/2020-12/schema",
                    type: "array",
                    prefixItems: [
                        { type: "string", minLength: 2 },
                        { type: "number", minimum: 0 },
                    ],
                    minItems: 2,
                    maxItems: 2,
                };

                const zodSchema = convertJsonSchemaToZod(jsonSchema);

                expect(() => zodSchema.parse(["hi", 5])).not.toThrow();
                expect(() => zodSchema.parse(["a", 5])).toThrow(); // string too short
                expect(() => zodSchema.parse(["hi", -1])).toThrow(); // number too small
            });

            it("should handle prefixItems with items: false (strict tuple)", () => {
                const jsonSchema: JSONSchema.BaseSchema = {
                    $schema: "https://json-schema.org/draft/2020-12/schema",
                    type: "array",
                    prefixItems: [{ type: "string" }, { type: "number" }],
                    items: false,
                };

                const zodSchema = convertJsonSchemaToZod(jsonSchema);

                expect(() => zodSchema.parse(["hello", 42])).not.toThrow();
                expect(() => zodSchema.parse(["hello", 42, "extra"])).toThrow(); // no additional items allowed
                expect(() => zodSchema.parse(["hello"])).not.toThrow(); // partial tuple OK
                expect(() => zodSchema.parse([])).not.toThrow(); // empty array OK
            });

            it("should handle prefixItems with items schema (constrained additional items)", () => {
                const jsonSchema: JSONSchema.BaseSchema = {
                    $schema: "https://json-schema.org/draft/2020-12/schema",
                    type: "array",
                    prefixItems: [{ type: "string" }, { type: "number" }],
                    items: { type: "boolean" },
                };

                const zodSchema = convertJsonSchemaToZod(jsonSchema);

                expect(() => zodSchema.parse(["hello", 42])).not.toThrow();
                expect(() => zodSchema.parse(["hello", 42, true])).not.toThrow();
                expect(() => zodSchema.parse(["hello", 42, true, false])).not.toThrow();
                expect(() => zodSchema.parse(["hello", 42, "string"])).toThrow(); // additional item wrong type
                expect(() => zodSchema.parse(["hello"])).not.toThrow(); // partial tuple OK
                expect(() => zodSchema.parse([])).not.toThrow(); // empty array OK
            });
        });
    });
});

describe("jsonSchemaObjectToZodRawShape", () => {
    it("should extract properties from a JSON schema", () => {
        const jsonSchema: JSONSchema.BaseSchema = {
            type: "object",
            properties: {
                name: { type: "string" },
                age: { type: "integer" },
                isActive: { type: "boolean" },
                // @ts-expect-error: invalid schema definition to test behaviour
                missing: undefined,
            },
            required: ["name", "age"],
        };

        // @ts-expect-error: invalid schema definition to test behaviour
        const rawShape = jsonSchemaObjectToZodRawShape(jsonSchema);

        // Properties should exist in the raw shape
        expect(rawShape).toHaveProperty("name");
        expect(rawShape).toHaveProperty("age");
        expect(rawShape).toHaveProperty("isActive");

        // Verify types are correct - required fields are direct types
        expect(rawShape.name instanceof z.ZodString).toBe(true);
        expect(rawShape.age instanceof z.ZodNumber).toBe(true);

        // isActive is not in required array, so it should be optional
        expect(rawShape.isActive instanceof z.ZodOptional).toBe(true);
        // Check the inner type of the optional
        expect((rawShape.isActive as z.ZodOptional<any>)._def.innerType instanceof z.ZodBoolean).toBe(true);
    });

    it("should handle empty properties", () => {
        const jsonSchema: JSONSchema.BaseSchema = {
            type: "object",
            properties: {},
        };

        // @ts-expect-error: invalid schema definition to test behaviour
        const rawShape = jsonSchemaObjectToZodRawShape(jsonSchema);
        expect(Object.keys(rawShape).length).toBe(0);
        expect(rawShape).toEqual({});
    });

    it("should handle missing properties field", () => {
        const jsonSchema: JSONSchema.BaseSchema = {
            type: "object",
        };

        // @ts-expect-error: invalid schema definition to test behaviour
        const rawShape = jsonSchemaObjectToZodRawShape(jsonSchema);
        expect(Object.keys(rawShape).length).toBe(0);
        expect(rawShape).toEqual({});
    });

    it("should correctly convert nested object properties", () => {
        const jsonSchema: JSONSchema.BaseSchema = {
            type: "object",
            properties: {
                user: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        email: { type: "string" },
                        // @ts-expect-error: invalid schema definition to test behaviour
                        missing: undefined,
                    },
                    required: ["name"],
                },
            },
        };

        // @ts-expect-error: invalid schema definition to test behaviour
        const rawShape = jsonSchemaObjectToZodRawShape(jsonSchema);

        expect(rawShape).toHaveProperty("user");
        // Since there's no required array at the top level, user field is optional
        expect(rawShape.user instanceof z.ZodOptional).toBe(true);
        // The inner type should be a ZodObject
        expect((rawShape.user as z.ZodOptional<any>)._def.innerType instanceof z.ZodObject).toBe(true);

        // Create a schema with the raw shape to test validation
        const schema = z.object(rawShape);

        // Valid data should pass
        expect(() =>
            schema.parse({
                user: { name: "John", email: "john@example.com" },
            }),
        ).not.toThrow();

        // Missing required field should fail
        expect(() =>
            schema.parse({
                user: { email: "john@example.com" },
            }),
        ).toThrow();

        // Since user is optional at the top level, empty object should pass
        expect(() => schema.parse({})).not.toThrow();
    });

    it("should be usable to build custom schemas", () => {
        const jsonSchema: JSONSchema.BaseSchema = {
            type: "object",
            properties: {
                name: { type: "string" },
                age: { type: "integer" },
            },
        };

        // Get the raw shape
        // @ts-expect-error: invalid schema definition to test behaviour
        const rawShape = jsonSchemaObjectToZodRawShape(jsonSchema);

        // Make fields optional manually and add custom fields
        const customSchema = z
            .object({
                name: rawShape.name.optional(),
                age: rawShape.age.optional(),
                createdAt: z.date().default(() => new Date()),
            })
            .refine((data) => data.age === undefined || data.age > 18, {
                message: "Age must be over 18",
            });

        // Test validation with the custom schema - all fields work
        const validData = customSchema.parse({
            name: "John",
            age: 25,
        });
        expect(validData).toHaveProperty("name", "John");
        expect(validData).toHaveProperty("age", 25);
        expect(validData).toHaveProperty("createdAt");
        expect(validData.createdAt instanceof Date).toBe(true);

        // Test with missing fields
        const dataWithMissingField = customSchema.parse({});
        expect(dataWithMissingField).toHaveProperty("createdAt");

        // Test refinement with invalid age
        expect(() => customSchema.parse({ age: 16 })).toThrow();

        // Refinement with correct age, using same format as above test to confirm error was throw for correct reason
        expect(() => customSchema.parse({ age: 19 })).not.toThrow();
    });

    it("should respect the required field when converting object properties", () => {
        const jsonSchema = {
            type: "object",
            properties: {
                requiredField: { type: "string" },
                optionalField: { type: "number" },
                anotherRequired: { type: "boolean" },
            },
            required: ["requiredField", "anotherRequired"],
        };

        const rawShape = jsonSchemaObjectToZodRawShape(jsonSchema);

        // Create a schema to test the shape
        const schema = z.object(rawShape);

        // Required fields should be required
        expect(() =>
            schema.parse({
                optionalField: 42,
            }),
        ).toThrow(); // Missing required fields

        // Optional field should be optional
        expect(() =>
            schema.parse({
                requiredField: "test",
                anotherRequired: true,
            }),
        ).not.toThrow(); // Optional field missing is OK

        // All fields present should work
        expect(() =>
            schema.parse({
                requiredField: "test",
                optionalField: 42,
                anotherRequired: true,
            }),
        ).not.toThrow();
    });

    it("should make all fields optional when required array is not present", () => {
        const jsonSchema = {
            type: "object",
            properties: {
                field1: { type: "string" },
                field2: { type: "number" },
                field3: { type: "boolean" },
            },
            // No required field - all properties should be optional
        };

        const rawShape = jsonSchemaObjectToZodRawShape(jsonSchema);
        const schema = z.object(rawShape);

        // All fields should be optional
        expect(() => schema.parse({})).not.toThrow();
        expect(() => schema.parse({ field1: "test" })).not.toThrow();
        expect(() => schema.parse({ field2: 42 })).not.toThrow();
        expect(() => schema.parse({ field3: true })).not.toThrow();
        expect(() =>
            schema.parse({
                field1: "test",
                field2: 42,
                field3: true,
            }),
        ).not.toThrow();
    });

    it("schema with defaults should parse empty objects", () => {
        const jsonSchema = {
            type: "object",
            properties: {
                field1: { type: "string", default: "test" },
                field2: { type: "number", default: 42 },
                field3: { type: "boolean", default: true },
                field4: { type: "string", enum: ["test1", "test2"], default: "test2" },
                field5: {
                    type: "object",
                    default: { name: "test", age: 10, isActive: true },
                    properties: {
                        name: { type: "string" },
                        age: { type: "integer", minimum: -43, maximum: 120 },
                        isActive: { type: "boolean" },
                    },
                    required: ["name", "age", "isActive"],
                },
                field6: { type: "string", default: 42 },
            },
            // No required field - all properties should be optional
        };

        const rawShape = jsonSchemaObjectToZodRawShape(jsonSchema);
        const schema = z.object(rawShape);

        // All fields should be optional
        expect(() => schema.parse({})).not.toThrow();
        expect(schema.parse({})).toEqual({
            field1: "test",
            field2: 42,
            field3: true,
            field4: "test2",
            field5: { name: "test", age: 10, isActive: true },
            // `field6` doesn't get the default, because it's not the correct type
        });
    });
});
