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
});
