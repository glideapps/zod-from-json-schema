import { describe, it, expect } from "vitest";
import { convertJsonSchemaToZod } from "./index";
import { zodToJsonSchema } from "zod-to-json-schema";

describe("convertJsonSchemaToZod", () => {
  it("should correctly convert a schema with additionalProperties: true", () => {
    // Define a simple JSON schema
    const jsonSchema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "integer" },
        isActive: { type: "boolean" },
      },
      required: ["name", "age"],
      additionalProperties: true,
    };

    // Convert JSON schema to Zod
    const zodSchema = convertJsonSchemaToZod(jsonSchema);

    // Convert Zod schema back to JSON schema
    const resultSchema = zodToJsonSchema(zodSchema);

    // Compare the original and resulting schemas
    expect(resultSchema).toEqual(jsonSchema);
  });

  it("should correctly convert a schema with additionalProperties: false", () => {
    // Define a JSON schema with additionalProperties: false
    const jsonSchema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "integer" },
      },
      required: ["name"],
      additionalProperties: false,
    };

    // Convert JSON schema to Zod
    const zodSchema = convertJsonSchemaToZod(jsonSchema);

    // Convert Zod schema back to JSON schema
    const resultSchema = zodToJsonSchema(zodSchema);

    // Compare the original and resulting schemas
    expect(resultSchema).toEqual(jsonSchema);
  });

  it("should correctly convert a schema with array type", () => {
    const jsonSchema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "array",
      items: {
        type: "string"
      }
    };

    const zodSchema = convertJsonSchemaToZod(jsonSchema);
    const resultSchema = zodToJsonSchema(zodSchema);
    expect(resultSchema).toEqual(jsonSchema);
  });

  it("should correctly convert a schema with enum", () => {
    const jsonSchema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      enum: ["red", "green", "blue"]
    };

    const zodSchema = convertJsonSchemaToZod(jsonSchema);
    const resultSchema = zodToJsonSchema(zodSchema);
    
    // For enums, we just check that the original enum values are present
    expect(resultSchema.enum).toEqual(jsonSchema.enum);
  });

  // Tests for unimplemented but supported features
  describe("String validation", () => {
    it("should support minLength and maxLength constraints", () => {
      const jsonSchema = {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "string",
        minLength: 3,
        maxLength: 10
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      const resultSchema = zodToJsonSchema(zodSchema);
      expect(resultSchema).toEqual(jsonSchema);
    });

    it("should support pattern constraint", () => {
      const jsonSchema = {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "string",
        pattern: "^[a-zA-Z0-9]+$"
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      const resultSchema = zodToJsonSchema(zodSchema);
      expect(resultSchema).toEqual(jsonSchema);
    });
  });

  describe("Number validation", () => {
    it("should support minimum and maximum constraints", () => {
      const jsonSchema = {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "number",
        minimum: 0,
        maximum: 100
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      const resultSchema = zodToJsonSchema(zodSchema);
      expect(resultSchema).toEqual(jsonSchema);
    });

    it("should support exclusiveMinimum and exclusiveMaximum constraints", () => {
      const jsonSchema = {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "number",
        exclusiveMinimum: 0,
        exclusiveMaximum: 100
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      const resultSchema = zodToJsonSchema(zodSchema);
      expect(resultSchema).toEqual(jsonSchema);
    });

    it("should support multipleOf constraint", () => {
      const jsonSchema = {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "number",
        multipleOf: 5
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      const resultSchema = zodToJsonSchema(zodSchema);
      expect(resultSchema).toEqual(jsonSchema);
    });
  });

  describe("Array validation", () => {
    it("should support minItems and maxItems constraints", () => {
      const jsonSchema = {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "array",
        items: {
          type: "string"
        },
        minItems: 1,
        maxItems: 10
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      const resultSchema = zodToJsonSchema(zodSchema);
      expect(resultSchema).toEqual(jsonSchema);
    });

    it("should support uniqueItems constraint", () => {
      const jsonSchema = {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "array",
        items: {
          type: "string"
        },
        uniqueItems: true
      };

      const zodSchema = convertJsonSchemaToZod(jsonSchema);
      
      // Unfortunately, zod-to-json-schema doesn't properly translate refinements for uniqueItems
      // So we'll verify the functionality by testing with actual data
      expect(() => zodSchema.parse(["a", "b", "c"])).not.toThrow();
      expect(() => zodSchema.parse(["a", "a", "c"])).toThrow();
      
      // We can't do the normal round-trip test, so we'll verify key parts of the schema
      const resultSchema = zodToJsonSchema(zodSchema);
      expect(resultSchema.type).toEqual("array");
      expect(resultSchema.items).toEqual({ type: "string" });
    });
  });
});