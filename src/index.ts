import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { convertJsonSchemaToZod } from "./core/converter";
import { unwrapPreprocess } from "./core/utils";

// Re-export the main converter function
export { convertJsonSchemaToZod };

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

// Raw shape consumers expect "real" object types, so peel off preprocess/pipe layers that were introduced during conversion.
function unwrapPreprocess(schema: z.ZodTypeAny): z.ZodTypeAny {
    let current = schema;

    while (true) {
        const def = (current as any)?._def;
        if (def?.effect?.type === "preprocess" && def?.schema) {
            current = def.schema;
            continue;
        }

        if (def?.type === "pipe" && def?.out) {
            current = def.out;
            continue;
        }

        break;
    }

    return current;
}

/**
 * Converts a JSON Schema object to a Zod raw shape with proper typing
 * @param schema The JSON Schema object to convert
 * @returns A Zod raw shape for use with z.object() with inferred types
 */
export function jsonSchemaObjectToZodRawShape<T extends JSONSchema.Schema & { properties: Record<string, any> }>(
    schema: T,
): InferZodRawShape<T["properties"]>;

/**
 * Converts a JSON Schema object to a Zod raw shape
 * @param schema The JSON Schema object to convert
 * @returns A Zod raw shape for use with z.object()
 */
export function jsonSchemaObjectToZodRawShape(schema: JSONSchema.Schema): Record<string, z.ZodTypeAny>;

export function jsonSchemaObjectToZodRawShape(schema: JSONSchema.Schema): Record<string, z.ZodTypeAny> {
    const raw: Record<string, z.ZodType> = {};

    // Get the required fields set for efficient lookup
    const requiredArray = Array.isArray(schema.required) ? schema.required : [];
    const requiredFields = new Set<string>(requiredArray);

    for (const [key, value] of Object.entries(schema.properties ?? {})) {
        if (value === undefined) continue;

        const zodType = convertJsonSchemaToZod(value);
        let shapeType = unwrapPreprocess(zodType);

        // If there's a required array and the field is not in it, make it optional
        // If there's no required array, all fields are optional by default in JSON Schema
        if (requiredArray.length > 0) {
            if (!requiredFields.has(key)) {
                shapeType = shapeType.optional();
            }
        } else {
            // No required array means all fields are optional
            shapeType = shapeType.optional();
        }

        raw[key] = shapeType;
    }
    return raw;
}
