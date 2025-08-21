import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { convertJsonSchemaToZod } from "./core/converter";

// Re-export the main converter function
export { convertJsonSchemaToZod };

// Export utilities that tests might depend on
export { createUniqueItemsValidator, isValidWithSchema } from "./core/utils";

// Helper type to infer Zod types from JSON Schema properties
type InferZodTypeFromJsonSchema<T> = 
    T extends { type: "string" } ? z.ZodString :
    T extends { type: "number" } ? z.ZodNumber :
    T extends { type: "integer" } ? z.ZodNumber :
    T extends { type: "boolean" } ? z.ZodBoolean :
    T extends { type: "null" } ? z.ZodNull :
    T extends { type: "array" } ? z.ZodArray<z.ZodTypeAny> :
    T extends { type: "object" } ? z.ZodObject<any> :
    T extends { const: any } ? z.ZodLiteral<T["const"]> :
    T extends { enum: readonly any[] } ? z.ZodEnum<any> :
    z.ZodTypeAny;

// Helper type to map JSON Schema properties to Zod raw shape
type InferZodRawShape<T extends Record<string, any>> = {
    [K in keyof T]: InferZodTypeFromJsonSchema<T[K]>
};

/**
 * Converts a JSON Schema object to a Zod raw shape with proper typing
 * @param schema The JSON Schema object to convert
 * @returns A Zod raw shape for use with z.object() with inferred types
 */
export function jsonSchemaObjectToZodRawShape<
    T extends JSONSchema.Schema & { properties: Record<string, any> }
>(schema: T): InferZodRawShape<T["properties"]>;

/**
 * Converts a JSON Schema object to a Zod raw shape
 * @param schema The JSON Schema object to convert
 * @returns A Zod raw shape for use with z.object()
 */
export function jsonSchemaObjectToZodRawShape(schema: JSONSchema.Schema): Record<string, z.ZodTypeAny>;

export function jsonSchemaObjectToZodRawShape(schema: JSONSchema.Schema): Record<string, z.ZodTypeAny> {
    const raw: Record<string, z.ZodTypeAny> = {};
    
    for (const [key, value] of Object.entries(schema.properties ?? {})) {
        if (value === undefined) continue;
        raw[key] = convertJsonSchemaToZod(value);
    }
    return raw;
}