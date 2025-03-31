import { describe, it, expect } from "vitest";
import { convertJsonSchemaToZod, jsonSchemaObjectToZodRawShape } from "./index";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";

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

describe("jsonSchemaObjectToZodRawShape", () => {
  it("should extract properties from a JSON schema", () => {
    const jsonSchema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "integer" },
        isActive: { type: "boolean" },
      },
      required: ["name", "age"]
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
      properties: {}
    };

    const rawShape = jsonSchemaObjectToZodRawShape(jsonSchema);
    expect(Object.keys(rawShape).length).toBe(0);
    expect(rawShape).toEqual({});
  });

  it("should handle missing properties field", () => {
    const jsonSchema = {
      type: "object"
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
            email: { type: "string" }
          },
          required: ["name"]
        }
      }
    };

    const rawShape = jsonSchemaObjectToZodRawShape(jsonSchema);
    
    expect(rawShape).toHaveProperty("user");
    expect(rawShape.user instanceof z.ZodObject).toBe(true);
    
    // Create a schema with the raw shape to test validation
    const schema = z.object(rawShape);
    
    // Valid data should pass
    expect(() => schema.parse({
      user: { name: "John", email: "john@example.com" }
    })).not.toThrow();
    
    // Missing required field should fail
    expect(() => schema.parse({
      user: { email: "john@example.com" }
    })).toThrow();
  });

  it("should be usable to build custom schemas", () => {
    const jsonSchema = {
      properties: {
        name: { type: "string" },
        age: { type: "integer" }
      }
    };

    // Get the raw shape
    const rawShape = jsonSchemaObjectToZodRawShape(jsonSchema);
    
    // Make fields optional manually and add custom fields
    const customSchema = z.object({
      name: rawShape.name.optional(),
      age: rawShape.age.optional(),
      createdAt: z.date().default(() => new Date())
    }).refine(data => data.age === undefined || data.age > 18, {
      message: "Age must be over 18"
    });
    
    // Test validation with the custom schema - all fields work
    const validData = customSchema.parse({ 
      name: "John", 
      age: 25 
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
});