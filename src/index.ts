import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { convertJsonSchemaToZod } from "./core/converter";

// Re-export the main converter function
export { convertJsonSchemaToZod };

// Export utilities that tests might depend on
export { createUniqueItemsValidator, isValidWithSchema } from "./core/utils";

/**
 * Converts a JSON Schema object to a Zod raw shape
 * @param schema The JSON Schema object to convert
 * @returns A Zod raw shape for use with z.object()
 */
export function jsonSchemaObjectToZodRawShape(schema: JSONSchema.Schema): z.ZodRawShape {
    const raw: Record<string, z.ZodType> = {};

    // Get the required fields set for efficient lookup
    const requiredArray = Array.isArray(schema.required) ? schema.required : [];
    const requiredFields = new Set<string>(requiredArray);

    for (const [key, value] of Object.entries(schema.properties ?? {})) {
        if (value === undefined) continue;

        let zodType = convertJsonSchemaToZod(value);

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
