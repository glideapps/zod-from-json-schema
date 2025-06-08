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
    
    for (const [key, value] of Object.entries(schema.properties ?? {})) {
        if (value === undefined) continue;
        raw[key] = convertJsonSchemaToZod(value);
    }
    return raw;
}