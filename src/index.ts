import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { convertJsonSchemaToZod } from "./core/converter";
import type { ConversionOptions } from "./core/types";

// Re-export the main converter function
export { convertJsonSchemaToZod };

// Re-export conversion options for the public API
export type { ConversionOptions } from "./core/types";

// Export utilities that tests might depend on
export { createUniqueItemsValidator, isValidWithSchema } from "./core/utils";

// Helper type to infer Zod types from JSON Schema properties
type InferZodTypeFromJsonSchema<T> = T extends { type: "string" }
    ? z.ZodString
    : T extends { type: "number" }
      ? z.ZodNumber
      : T extends { type: "integer" }
        ? z.ZodNumber
        : T extends { type: "boolean" }
          ? z.ZodBoolean
          : T extends { type: "null" }
            ? z.ZodNull
            : T extends { type: "array" }
              ? z.ZodArray<z.ZodTypeAny>
              : T extends { type: "object" }
                ? z.ZodObject<any>
                : T extends { const: any }
                  ? z.ZodLiteral<T["const"]>
                  : T extends { enum: readonly any[] }
                    ? z.ZodEnum<any>
                    : z.ZodTypeAny;

// Helper type to map JSON Schema properties to Zod raw shape
type InferZodRawShape<T extends Record<string, any>> = {
    [K in keyof T]: InferZodTypeFromJsonSchema<T[K]>;
};

/**
 * Converts a JSON Schema object to a Zod raw shape with proper typing
 * @param schema The JSON Schema object to convert
 * @param options Optional conversion options
 * @returns A Zod raw shape for use with z.object() with inferred types
 */
export function jsonSchemaObjectToZodRawShape<T extends JSONSchema.Schema & { properties: Record<string, any> }>(
    schema: T,
    options?: ConversionOptions,
): InferZodRawShape<T["properties"]>;

/**
 * Converts a JSON Schema object to a Zod raw shape
 * @param schema The JSON Schema object to convert
 * @param options Optional conversion options
 * @returns A Zod raw shape for use with z.object()
 */
export function jsonSchemaObjectToZodRawShape(
    schema: JSONSchema.Schema,
    options?: ConversionOptions,
): Record<string, z.ZodTypeAny>;

export function jsonSchemaObjectToZodRawShape(
    schema: JSONSchema.Schema,
    options?: ConversionOptions,
): Record<string, z.ZodTypeAny> {
    const raw: Record<string, z.ZodType> = {};

    // Get the required fields set for efficient lookup
    const requiredArray = Array.isArray(schema.required) ? schema.required : [];
    const requiredFields = new Set<string>(requiredArray);

    for (const [key, value] of Object.entries(schema.properties ?? {})) {
        if (value === undefined) continue;
        // __proto__ can't be validated through this helper anyway (the parsed
        // object's __proto__ accessor returns Object.prototype, not the field
        // value — see README Known Limitations). Skip it explicitly so the
        // assignment below doesn't invoke the __proto__ setter and replace
        // this object's prototype.
        if (key === "__proto__") continue;

        let zodType = convertJsonSchemaToZod(value, options);

        // If there's a required array and the field is not in it, make it optional
        // If there's no required array, all fields are optional by default in JSON Schema
        if (requiredArray.length > 0) {
            if (!requiredFields.has(key)) {
                zodType = zodType.optional();
            }
        } else {
            // No required array means all fields are optional
            zodType = zodType.optional();
        }

        raw[key] = zodType;
    }
    return raw;
}
