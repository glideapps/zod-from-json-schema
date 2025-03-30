import { z } from "zod";

/**
 * Converts a JSON Schema object to a Zod schema
 */
export function convertJsonSchemaToZod(schema: any): z.ZodTypeAny {
    // Create a helper function to add metadata like description
    function addMetadata(
        zodSchema: z.ZodTypeAny,
        jsonSchema: any,
    ): z.ZodTypeAny {
        if (jsonSchema.description) {
            zodSchema = zodSchema.describe(jsonSchema.description);
        }
        return zodSchema;
    }

    // Handle const values - must be checked before other constraints
    if (schema.const !== undefined) {
        if (typeof schema.const === "string") {
            return addMetadata(z.literal(schema.const), schema);
        } else if (typeof schema.const === "number") {
            return addMetadata(z.literal(schema.const), schema);
        } else if (typeof schema.const === "boolean") {
            return addMetadata(z.literal(schema.const), schema);
        } else if (schema.const === null) {
            return addMetadata(z.null(), schema);
        }
        // For objects or arrays, handle as specific literals
        return addMetadata(z.literal(schema.const), schema);
    }

    // Handle primitive types
    if (schema.type) {
        switch (schema.type) {
            case "string":
                return addMetadata(z.string(), schema);
            case "number":
                return addMetadata(z.number(), schema);
            case "integer":
                return addMetadata(z.number().int(), schema);
            case "boolean":
                return addMetadata(z.boolean(), schema);
            case "null":
                return addMetadata(z.null(), schema);
            case "object":
                if (schema.properties) {
                    const shape: Record<string, z.ZodTypeAny> = {};

                    // Process each property
                    for (const [key, propSchema] of Object.entries(
                        schema.properties,
                    )) {
                        shape[key] = convertJsonSchemaToZod(propSchema);
                    }

                    // Handle required properties
                    if (schema.required && Array.isArray(schema.required)) {
                        // Mark all properties not in required as optional
                        const required = new Set(schema.required);
                        for (const key of Object.keys(shape)) {
                            if (!required.has(key)) {
                                shape[key] = shape[key].optional();
                            }
                        }
                    }

                    // Create the schema with or without passthrough based on additionalProperties
                    let zodSchema = z.object(shape);

                    // By default, JSON Schema allows additional properties, so use passthrough
                    // unless additionalProperties is explicitly set to false
                    if (schema.additionalProperties !== false) {
                        zodSchema = zodSchema.passthrough();
                    }

                    return addMetadata(zodSchema, schema);
                }
                return addMetadata(z.object({}), schema);
            case "array":
                let arraySchema;
                if (schema.items) {
                    arraySchema = z.array(convertJsonSchemaToZod(schema.items));
                } else {
                    arraySchema = z.array(z.any());
                }
                return addMetadata(arraySchema, schema);
        }
    }

    // Handle enum
    if (schema.enum) {
        return addMetadata(z.enum(schema.enum), schema);
    }

    // Handle combinations
    if (schema.anyOf) {
        return addMetadata(
            z.union(schema.anyOf.map(convertJsonSchemaToZod)),
            schema,
        );
    }

    if (schema.allOf) {
        return addMetadata(
            schema.allOf.reduce(
                (acc: z.ZodTypeAny, s: any) =>
                    z.intersection(acc, convertJsonSchemaToZod(s)),
                z.object({}),
            ),
            schema,
        );
    }

    if (schema.oneOf) {
        return addMetadata(
            z.union(schema.oneOf.map(convertJsonSchemaToZod)),
            schema,
        );
    }

    // Default fallback
    return addMetadata(z.any(), schema);
}

export function jsonSchemaObjectToZodRawShape(schema: any): z.ZodRawShape {
    let raw: z.ZodRawShape = {};
    for (const [key, value] of Object.entries(schema.properties ?? [])) {
        raw[key] = convertJsonSchemaToZod(value);
    }
    return raw;
}
