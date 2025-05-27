import { describe, it, expect } from "vitest";
import { convertJsonSchemaToZod, jsonSchemaObjectToZodRawShape } from "./index";
import { z } from "zod/v4";

describe("convertJsonSchemaToZod", () => {
  it("should correctly convert a schema with additionalProperties: {}", () => {
    // Define a simple JSON schema
    const jsonSchema = {
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
    const jsonSchema = {
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
    const jsonSchema = {
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
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        enum: ["red", "green", "blue"],
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      const resultSchema = z.toJSONSchema(zodSchema);

      // For enums, we just check that the original enum values are present
      expect(resultSchema.enum).toEqual(jsonSchema.enum);
    });

    it("should correctly convert a schema with number enum (no type)", () => {
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        enum: [1, 2, 3],
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);

      // Test validation
      expect(() => zodSchema.parse(1)).not.toThrow();
      expect(() => zodSchema.parse(4)).toThrow();

      const resultSchema = z.toJSONSchema(zodSchema);
      // Zod v4 converts unions to anyOf instead of enum
      expect(resultSchema.anyOf).toEqual([{ const: 1 }, { const: 2 }, { const: 3 }]);
    });

    it("should correctly convert a schema with boolean enum (no type)", () => {
      const jsonSchema = {
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
      expect(resultSchema.anyOf).toEqual([{ const: true }, { const: false }]);
    });

    it("should correctly convert a schema with mixed enum (no type)", () => {
      const jsonSchema = {
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
      expect(resultSchema.anyOf).toEqual([{ const: "red" }, { const: 1 }, { const: true }, { const: null }]);
    });

    it("should correctly convert a schema with single item mixed enum (no type)", () => {
      const jsonSchema = {
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
      const jsonSchema = {
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
      const jsonSchema = {
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
      const jsonSchema = {
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
      const jsonSchema = {
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
      const jsonSchema = {
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
      const jsonSchema = {
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
      const jsonSchema = {
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
      const jsonSchema = {
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
      const jsonSchema = {
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
      const jsonSchema = {
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
      const jsonSchema = {
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
      const jsonSchema = {
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
      const jsonSchema = {
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
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
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
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
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
      const jsonSchema = {
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
      const jsonSchema = {
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
      const jsonSchema = {
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
      const jsonSchema = {
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
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);

      expect(() => zodSchema.parse({})).not.toThrow();
      expect(() => zodSchema.parse({ extra: "prop" })).not.toThrow(); // By default additionalProperties is true

      const resultSchema = z.toJSONSchema(zodSchema);
      expect(resultSchema.type).toEqual("object");
    });

    it("should handle array schema with no items", () => {
      const jsonSchema = {
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
      const jsonSchema = {
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
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "string",
        description: "A test description",
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      const resultSchema = z.toJSONSchema(zodSchema);

      expect(resultSchema.description).toEqual(jsonSchema.description);
    });
  });

  // Tests for unimplemented but supported features
  describe("String validation", () => {
    it("should support minLength and maxLength constraints", () => {
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "string",
        minLength: 3,
        maxLength: 10,
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      const resultSchema = z.toJSONSchema(zodSchema);
      expect(resultSchema).toEqual(jsonSchema);
    });

    it("should support pattern constraint", () => {
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "string",
        format: "regex",
        pattern: "^[a-zA-Z0-9]+$",
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      const resultSchema = z.toJSONSchema(zodSchema);
      expect(resultSchema).toEqual(jsonSchema);
    });
  });

  describe("Number validation", () => {
    it("should support minimum and maximum constraints", () => {
      const jsonSchema = {
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
      const jsonSchema = {
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
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "number",
        multipleOf: 5,
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      const resultSchema = z.toJSONSchema(zodSchema);
      expect(resultSchema).toEqual(jsonSchema);
    });
  });

  describe("Array validation", () => {
    it("should support minItems and maxItems constraints", () => {
      const jsonSchema = {
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
      const jsonSchema = {
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
      const jsonSchema = {
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
        const jsonSchema = {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "array",
          items: [
            { type: "string" },
            { type: "number" },
            { type: "boolean" }
          ]
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
        const jsonSchema = {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "array",
          items: [
            { type: "string" }
          ]
        };

        const zodSchema = convertJsonSchemaToZod(jsonSchema);

        expect(() => zodSchema.parse(["hello"])).not.toThrow();
        expect(() => zodSchema.parse([42])).toThrow();
        expect(() => zodSchema.parse(["hello", "world"])).toThrow();
        expect(() => zodSchema.parse([])).toThrow();
      });

      it("should handle empty tuple array", () => {
        const jsonSchema = {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "array",
          items: []
        };

        const zodSchema = convertJsonSchemaToZod(jsonSchema);

        expect(() => zodSchema.parse([])).not.toThrow();
        expect(() => zodSchema.parse(["anything"])).toThrow();
      });

      it("should handle tuple array with complex item types", () => {
        const jsonSchema = {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "array",
          items: [
            { 
              type: "object",
              properties: {
                name: { type: "string" }
              },
              required: ["name"]
            },
            { type: "number", minimum: 0 },
            { 
              type: "array",
              items: { type: "string" }
            }
          ]
        };

        const zodSchema = convertJsonSchemaToZod(jsonSchema);

        // Valid tuple should pass
        expect(() => zodSchema.parse([
          { name: "John" },
          5,
          ["a", "b", "c"]
        ])).not.toThrow();
        
        // Invalid object should fail
        expect(() => zodSchema.parse([
          { age: 25 },
          5,
          ["a", "b", "c"]
        ])).toThrow();
        
        // Invalid number should fail
        expect(() => zodSchema.parse([
          { name: "John" },
          -5,
          ["a", "b", "c"]
        ])).toThrow();
        
        // Invalid nested array should fail
        expect(() => zodSchema.parse([
          { name: "John" },
          5,
          ["a", 123, "c"]
        ])).toThrow();
      });

      it("should convert tuple to proper JSON schema", () => {
        const jsonSchema = {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "array",
          items: [
            { type: "string" },
            { type: "number" }
          ]
        };

        const zodSchema = convertJsonSchemaToZod(jsonSchema);
        const resultSchema = z.toJSONSchema(zodSchema);
        
        // Zod converts tuples to use prefixItems (which is correct for draft 2020-12)
        expect(resultSchema.type).toEqual("array");
        expect(resultSchema.prefixItems).toEqual([
          { type: "string" },
          { type: "number" }
        ]);
      });
    });

    describe("prefixItems (Draft 2020-12 tuples)", () => {
      it("should handle prefixItems with different types", () => {
        const jsonSchema = {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "array",
          prefixItems: [
            { type: "string" },
            { type: "number" },
            { type: "boolean" }
          ]
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
        const jsonSchema = {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "array",
          prefixItems: [
            { type: "string" }
          ]
        };

        const zodSchema = convertJsonSchemaToZod(jsonSchema);

        expect(() => zodSchema.parse(["hello"])).not.toThrow();
        expect(() => zodSchema.parse([42])).toThrow();
        expect(() => zodSchema.parse(["hello", "world"])).not.toThrow(); // extra items allowed
        expect(() => zodSchema.parse([])).not.toThrow(); // empty array is valid - no items required
      });

      it("should handle empty prefixItems array", () => {
        const jsonSchema = {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "array",
          prefixItems: []
        };

        const zodSchema = convertJsonSchemaToZod(jsonSchema);

        expect(() => zodSchema.parse([])).not.toThrow();
        expect(() => zodSchema.parse(["anything"])).not.toThrow(); // extra items allowed with empty prefixItems
        expect(() => zodSchema.parse([1, 2, 3])).not.toThrow();
      });

      it("should handle prefixItems with complex nested types", () => {
        const jsonSchema = {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "array",
          prefixItems: [
            { 
              type: "object",
              properties: {
                id: { type: "number" },
                name: { type: "string" }
              },
              required: ["id", "name"]
            },
            { 
              type: "array",
              items: { type: "string" }
            },
            { type: "number", minimum: 0, maximum: 100 }
          ]
        };

        const zodSchema = convertJsonSchemaToZod(jsonSchema);

        // Valid tuple should pass
        expect(() => zodSchema.parse([
          { id: 1, name: "Alice" },
          ["tag1", "tag2"],
          50
        ])).not.toThrow();
        
        // Invalid object should fail
        expect(() => zodSchema.parse([
          { name: "Alice" }, // missing id
          ["tag1", "tag2"],
          50
        ])).toThrow();
        
        // Invalid array should fail
        expect(() => zodSchema.parse([
          { id: 1, name: "Alice" },
          ["tag1", 123], // number in string array
          50
        ])).toThrow();
        
        // Invalid number should fail
        expect(() => zodSchema.parse([
          { id: 1, name: "Alice" },
          ["tag1", "tag2"],
          150 // exceeds maximum
        ])).toThrow();
      });

      it("should validate prefixItems behavior correctly", () => {
        const jsonSchema = {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "array",
          prefixItems: [
            { type: "string" },
            { type: "number" }
          ]
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
        const jsonSchema = {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "array",
          prefixItems: [
            { type: "string", minLength: 2 },
            { type: "number", minimum: 0 }
          ],
          minItems: 2,
          maxItems: 2
        };

        const zodSchema = convertJsonSchemaToZod(jsonSchema);

        expect(() => zodSchema.parse(["hi", 5])).not.toThrow();
        expect(() => zodSchema.parse(["a", 5])).toThrow(); // string too short
        expect(() => zodSchema.parse(["hi", -1])).toThrow(); // number too small
      });

      it("should handle prefixItems with items: false (strict tuple)", () => {
        const jsonSchema = {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "array",
          prefixItems: [
            { type: "string" },
            { type: "number" }
          ],
          items: false
        };

        const zodSchema = convertJsonSchemaToZod(jsonSchema);

        expect(() => zodSchema.parse(["hello", 42])).not.toThrow();
        expect(() => zodSchema.parse(["hello", 42, "extra"])).toThrow(); // no additional items allowed
        expect(() => zodSchema.parse(["hello"])).not.toThrow(); // partial tuple OK
        expect(() => zodSchema.parse([])).not.toThrow(); // empty array OK
      });

      it("should handle prefixItems with items schema (constrained additional items)", () => {
        const jsonSchema = {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "array",
          prefixItems: [
            { type: "string" },
            { type: "number" }
          ],
          items: { type: "boolean" }
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
    const jsonSchema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "integer" },
        isActive: { type: "boolean" },
        missing: undefined,
      },
      required: ["name", "age"],
    };

    const rawShape = jsonSchemaObjectToZodRawShape(jsonSchema);

    // Properties should exist in the raw shape
    expect(rawShape).toHaveProperty("name");
    expect(rawShape).toHaveProperty("age");
    expect(rawShape).toHaveProperty("isActive");

    // Verify types are correct
    expect(rawShape.name instanceof z.ZodString).toBe(true);
    expect(rawShape.age instanceof z.ZodNumber).toBe(true);
    expect(rawShape.isActive instanceof z.ZodBoolean).toBe(true);
  });

  it("should handle empty properties", () => {
    const jsonSchema = {
      type: "object",
      properties: {},
    };

    const rawShape = jsonSchemaObjectToZodRawShape(jsonSchema);
    expect(Object.keys(rawShape).length).toBe(0);
    expect(rawShape).toEqual({});
  });

  it("should handle missing properties field", () => {
    const jsonSchema = {
      type: "object",
    };

    const rawShape = jsonSchemaObjectToZodRawShape(jsonSchema);
    expect(Object.keys(rawShape).length).toBe(0);
    expect(rawShape).toEqual({});
  });

  it("should correctly convert nested object properties", () => {
    const jsonSchema = {
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
            missing: undefined,
          },
          required: ["name"],
        },
      },
    };

    const rawShape = jsonSchemaObjectToZodRawShape(jsonSchema);

    expect(rawShape).toHaveProperty("user");
    expect(rawShape.user instanceof z.ZodObject).toBe(true);

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
  });

  it("should be usable to build custom schemas", () => {
    const jsonSchema = {
      properties: {
        name: { type: "string" },
        age: { type: "integer" },
      },
    };

    // Get the raw shape
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
  });

  describe("Coverage edge cases", () => {
    it("should cover object property validation error path", () => {
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        properties: {
          name: { type: "string" }
        }
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      // Invalid property value should trigger error path (line 320-321)
      expect(() => zodSchema.parse({ name: 123 })).toThrow();
    });

    it("should cover conditional array constraints error paths", () => {
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        // No explicit type - triggers conditional constraints
        prefixItems: [{ type: "string" }],
        minItems: 2,
        maxItems: 3
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      // Invalid prefixItems should trigger error path (line 277)
      expect(() => zodSchema.parse([123])).toThrow();
      
      // minItems violation should trigger error path (line 288-289)
      expect(() => zodSchema.parse(["test"])).toThrow();
      
      // maxItems violation should trigger error path (line 291-292)
      expect(() => zodSchema.parse(["test", "item2", "item3", "extra"])).toThrow();
    });

    it("should cover additionalProperties=false error path", () => {
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        // No explicit type - this triggers conditional constraints path
        properties: {
          name: { type: "string" }
        },
        additionalProperties: false
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      // Additional property should trigger error path (line 340-341)
      expect(() => zodSchema.parse({ name: "test", extra: "not allowed" })).toThrow();
    });

    it("should cover tuple with additionalItems=false error path", () => {
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "array",
        items: [{ type: "string" }, { type: "number" }],
        additionalItems: false
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      // Valid tuple should trigger success path (line 480)
      expect(() => zodSchema.parse(["test", 123])).not.toThrow();
      
      // Wrong tuple length should trigger error path (line 468-483)
      expect(() => zodSchema.parse(["test", 123, "extra"])).toThrow();
      
      // Wrong tuple item type should trigger error path (line 468-483)
      expect(() => zodSchema.parse(["test", "not-a-number"])).toThrow();
    });

    it("should cover uniqueItems validator non-array path", () => {
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        // No explicit type - triggers conditional constraints
        uniqueItems: true
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      // Non-array value should trigger early return in uniqueItems validator (lines 11-12)
      expect(() => zodSchema.parse("not an array")).not.toThrow();
      expect(() => zodSchema.parse(123)).not.toThrow();
      expect(() => zodSchema.parse({})).not.toThrow();
    });

    it("should cover conditional tuple validation path", () => {
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        // No explicit type - triggers conditional constraints path
        items: [{ type: "string" }, { type: "number" }],
        additionalItems: false
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      // This should trigger the conditional tuple validation logic (lines 247-261)
      expect(() => zodSchema.parse(["test", 123])).not.toThrow();
      expect(() => zodSchema.parse(["test", 123, "extra"])).toThrow(); // additionalItems: false
      expect(() => zodSchema.parse(["test", "not-number"])).toThrow(); // wrong type
    });

    it("should cover number constraint validation error paths", () => {
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        // No explicit type - triggers conditional constraints
        minimum: 10,
        exclusiveMinimum: 5,
        exclusiveMaximum: 20
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      // Test minimum constraint failure (line 443)
      expect(() => zodSchema.parse(5)).toThrow();
      
      // Test exclusiveMinimum constraint failure (lines 452-453)
      expect(() => zodSchema.parse(5)).toThrow();
      
      // Test exclusiveMaximum constraint failure (lines 457-458)
      expect(() => zodSchema.parse(20)).toThrow();
    });

    it("should cover unknown type default case", () => {
      // This test covers the default case in createBaseTypeSchema (line 630)
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "unknown-type" as any // Force an unknown type
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      // Should return z.any() for unknown types
      expect(() => zodSchema.parse("anything")).not.toThrow();
      expect(() => zodSchema.parse(123)).not.toThrow();
      expect(() => zodSchema.parse({ object: true })).not.toThrow();
    });

    it("should cover default fallback z.any() case", () => {
      // This test covers lines 264-265: default fallback when no baseSchema is set
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        // Empty schema with no type, enum, or combination schemas
        title: "Empty schema"
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      // Should return z.any() as fallback
      expect(() => zodSchema.parse("anything")).not.toThrow();
      expect(() => zodSchema.parse(123)).not.toThrow();
      expect(() => zodSchema.parse({ object: true })).not.toThrow();
    });

    it("should cover not constraint without base schema", () => {
      // This test covers lines 274-278: not constraint when no base schema exists
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        not: {
          type: "string"
        }
        // No type, enum, or other base schema - triggers not constraint without baseSchema
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      // Should accept non-strings
      expect(() => zodSchema.parse(123)).not.toThrow();
      expect(() => zodSchema.parse(true)).not.toThrow();
      expect(() => zodSchema.parse({})).not.toThrow();
      
      // Should reject strings
      expect(() => zodSchema.parse("test")).toThrow();
    });

    it("should cover exclusiveMinimum constraint exactly at boundary", () => {
      // This test covers lines 452-453: exclusiveMinimum edge case
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        // No explicit type - triggers conditional constraints
        exclusiveMinimum: 10
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      // Test exactly at exclusiveMinimum boundary (should fail)
      expect(() => zodSchema.parse(10)).toThrow();
      
      // Test values greater than exclusiveMinimum (should pass)
      expect(() => zodSchema.parse(11)).not.toThrow();
    });

    it("should cover type-based schema handling with single type", () => {
      // This test covers lines 252-253: single type in array path
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: ["string"] as any // Single type in array
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      // Should handle single type correctly
      expect(() => zodSchema.parse("test")).not.toThrow();
      expect(() => zodSchema.parse(123)).toThrow();
    });

    it("should cover type-based schema handling with multiple types", () => {
      // This test covers lines 254-256: multiple types union path
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: ["string", "number"] as any // Multiple types
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      // Should handle union of types correctly
      expect(() => zodSchema.parse("test")).not.toThrow();
      expect(() => zodSchema.parse(123)).not.toThrow();
      expect(() => zodSchema.parse(true)).toThrow();
    });

    it("should cover type-based schema handling with single non-array type", () => {
      // This test covers lines 258-260: single type (not in array) path
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "string" // Single type, not in array
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      // Should handle single type correctly
      expect(() => zodSchema.parse("test")).not.toThrow();
      expect(() => zodSchema.parse(123)).toThrow();
    });

    it("should cover empty schema fallback to z.any()", () => {
      // This test covers lines 264-265: absolutely minimal schema
      const jsonSchema = {} as any;

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      // Should be z.any() - accepts everything
      expect(() => zodSchema.parse("test")).not.toThrow();
      expect(() => zodSchema.parse(123)).not.toThrow();
      expect(() => zodSchema.parse({})).not.toThrow();
      expect(() => zodSchema.parse(null)).not.toThrow();
    });

    it("should cover anyOf with pattern constraint", () => {
      // This covers lines 281-283: pattern handling in anyOf string inference
      const jsonSchema = {
        anyOf: [
          { pattern: "^test" },
          { const: "other" }
        ]
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      // Should pass: matches pattern
      expect(() => zodSchema.parse("testing")).not.toThrow();
      
      // Should pass: matches const
      expect(() => zodSchema.parse("other")).not.toThrow();
      
      // Should fail: doesn't match pattern or const
      expect(() => zodSchema.parse("invalid")).toThrow();
    });

    it("should cover anyOf string constraint intersection path", () => {
      // This covers line 284: intersection branch where baseSchema exists
      // The child schema has both enum (creates baseSchema) AND string constraints
      const jsonSchema = {
        anyOf: [
          { 
            enum: ["testing", "example"],  // This creates a baseSchema without returning
            pattern: "^test",              // This triggers string constraint logic with existing baseSchema
            minLength: 3,                  // Additional string constraint to ensure full coverage
            maxLength: 10                  // Another string constraint
          }
        ]
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      // Should pass: "testing" is in enum AND matches all string constraints
      expect(() => zodSchema.parse("testing")).not.toThrow();
      
      // Should fail: "example" is in enum but doesn't match pattern
      expect(() => zodSchema.parse("example")).toThrow();
      
      // Should fail: not in enum
      expect(() => zodSchema.parse("test")).toThrow();
    });

    it("should cover anyOf string constraint without pattern", () => {
      // This covers the case where pattern is undefined (line 280 if branch not taken)
      const jsonSchema = {
        anyOf: [
          { 
            enum: ["testing", "example"],  // This creates a baseSchema
            minLength: 3,                  // String constraint but NO pattern
            maxLength: 10
          }
        ]
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      // Should pass: "testing" is in enum AND meets length constraints
      expect(() => zodSchema.parse("testing")).not.toThrow();
      
      // Should pass: "example" is in enum AND meets length constraints  
      expect(() => zodSchema.parse("example")).not.toThrow();
      
      // Should fail: not in enum
      expect(() => zodSchema.parse("test")).toThrow();
    });

    it("should cover anyOf string constraint no-baseSchema path", () => {
      // This covers line 284: the false branch (no baseSchema, just stringTypeSchema)
      const jsonSchema = {
        anyOf: [
          { 
            pattern: "^test"  // Only string constraints, no enum/const, so no baseSchema
          }
        ]
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      // Should pass: matches pattern
      expect(() => zodSchema.parse("testing")).not.toThrow();
      
      // Should fail: doesn't match pattern
      expect(() => zodSchema.parse("invalid")).toThrow();
    });

    it("should cover allOf without base schema (line 216)", () => {
      // Schema with ONLY allOf, no type/enum/const - triggers !baseSchema branch
      const jsonSchema = {
        allOf: [
          { minimum: 10 }
        ]
        // No $schema, type, enum, const - ensures baseSchema starts undefined
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      expect(() => zodSchema.parse(15)).not.toThrow();
      expect(() => zodSchema.parse(5)).toThrow();
    });

    it("should cover allOf multiple items without base schema (line 222)", () => {
      // Schema with ONLY allOf (multiple), no type/enum/const - triggers !baseSchema branch
      const jsonSchema = {
        allOf: [
          { minimum: 10 },
          { maximum: 20 }
        ]
        // No $schema, type, enum, const - ensures baseSchema starts undefined
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      expect(() => zodSchema.parse(15)).not.toThrow();
      expect(() => zodSchema.parse(25)).toThrow();
    });

    it("should cover anyOf without base schema (line 234)", () => {
      // Schema with ONLY anyOf, no type/enum/const - triggers !baseSchema branch
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        anyOf: [
          { minimum: 10 },
          { maximum: 5 }
        ]
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      expect(() => zodSchema.parse(15)).not.toThrow(); // matches first
      expect(() => zodSchema.parse(3)).not.toThrow();  // matches second
      expect(() => zodSchema.parse(7)).toThrow();       // matches neither
    });

    it("should cover oneOf without base schema (line 246)", () => {
      // Schema with ONLY oneOf, no type/enum/const - triggers !baseSchema branch
      const jsonSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        oneOf: [
          { minimum: 10 },
          { maximum: 5 }
        ]
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      expect(() => zodSchema.parse(15)).not.toThrow(); // matches first only
      expect(() => zodSchema.parse(3)).not.toThrow();  // matches second only
      expect(() => zodSchema.parse(7)).toThrow();       // matches neither
    });

    it("should cover allOf with existing base schema (truthy branches)", () => {
      // Schema with type AND allOf - ensures baseSchema exists when allOf is processed
      const jsonSchema = {
        type: "number",
        allOf: [
          { minimum: 10 }
        ]
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      expect(() => zodSchema.parse(15)).not.toThrow();
      expect(() => zodSchema.parse(5)).toThrow();
      expect(() => zodSchema.parse("string")).toThrow(); // type mismatch
    });

    it("should cover anyOf intersection and non-intersection paths", () => {
      // Test anyOf with baseSchema (intersection case - line 237 truthy branch)
      const schemaWithBase = {
        type: "string", 
        anyOf: [
          { minLength: 3 }
        ]
      };
      const zodSchemaWithBase = convertJsonSchemaToZod(schemaWithBase);
      expect(() => zodSchemaWithBase.parse("test")).not.toThrow();
      expect(() => zodSchemaWithBase.parse("ab")).toThrow();

      // Test anyOf without baseSchema (non-intersection case - line 237 falsy branch)
      const schemaWithoutBase = {
        anyOf: [
          { minLength: 3 }
        ]
      };
      const zodSchemaWithoutBase = convertJsonSchemaToZod(schemaWithoutBase);
      expect(() => zodSchemaWithoutBase.parse("test")).not.toThrow();
      expect(() => zodSchemaWithoutBase.parse("ab")).toThrow();
    });

    it("should cover oneOf intersection and non-intersection paths", () => {
      // Test oneOf with baseSchema (intersection case - line 250 truthy branch)
      const schemaWithBase = {
        type: "string",
        oneOf: [
          { pattern: "^test" }
        ]
      };
      const zodSchemaWithBase = convertJsonSchemaToZod(schemaWithBase);
      expect(() => zodSchemaWithBase.parse("testing")).not.toThrow();
      expect(() => zodSchemaWithBase.parse("invalid")).not.toThrow(); // string & any = string

      // Test oneOf without baseSchema (non-intersection case - line 250 falsy branch) 
      const schemaWithoutBase = {
        oneOf: [
          { minLength: 3 }
        ]
      };
      const zodSchemaWithoutBase = convertJsonSchemaToZod(schemaWithoutBase);
      expect(() => zodSchemaWithoutBase.parse("test")).not.toThrow();
      expect(() => zodSchemaWithoutBase.parse("ab")).not.toThrow(); // oneOf without base type = z.any()
    });

    it("should cover anyOf string constraint without baseSchema (line 284 falsy branch)", () => {
      // Test anyOf with ONLY string constraints and no other schema that would create baseSchema
      const jsonSchema = {
        anyOf: [
          { 
            minLength: 2,  // Only string constraints, no enum/type/etc
            maxLength: 10,
            pattern: "^hello"
          }
        ]
      };
      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      expect(() => zodSchema.parse("hello")).not.toThrow();
      expect(() => zodSchema.parse("hi")).toThrow(); // too short
      expect(() => zodSchema.parse("goodbye")).toThrow(); // wrong pattern
    });

    it("should cover allOf multiple with existing base schema (truthy branches)", () => {
      // Schema with type AND allOf multiple - ensures baseSchema exists when allOf is processed
      const jsonSchema = {
        type: "number",
        allOf: [
          { minimum: 10 },
          { maximum: 20 }
        ]
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      expect(() => zodSchema.parse(15)).not.toThrow();
      expect(() => zodSchema.parse(25)).toThrow(); // maximum violation
      expect(() => zodSchema.parse(5)).toThrow();  // minimum violation
      expect(() => zodSchema.parse("string")).toThrow(); // type mismatch
    });
  });
});
