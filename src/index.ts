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
            case "string": {
                let stringSchema = z.string();

                // Apply string-specific constraints
                if (schema.minLength !== undefined) {
                    stringSchema = stringSchema.min(schema.minLength);
                }
                if (schema.maxLength !== undefined) {
                    stringSchema = stringSchema.max(schema.maxLength);
                }
                if (schema.pattern !== undefined) {
                    const regex = new RegExp(schema.pattern);
                    stringSchema = stringSchema.regex(regex);
                }

                return addMetadata(stringSchema, schema);
            }
            case "number":
            case "integer": {
                let numberSchema = schema.type === "integer" ? z.number().int() : z.number();

                // Apply number-specific constraints
                if (schema.minimum !== undefined) {
                    numberSchema = numberSchema.min(schema.minimum);
                }
                if (schema.maximum !== undefined) {
                    numberSchema = numberSchema.max(schema.maximum);
                }
                if (schema.exclusiveMinimum !== undefined) {
                    numberSchema = numberSchema.gt(schema.exclusiveMinimum);
                }
                if (schema.exclusiveMaximum !== undefined) {
                    numberSchema = numberSchema.lt(schema.exclusiveMaximum);
                }
                if (schema.multipleOf !== undefined) {
                    numberSchema = numberSchema.multipleOf(schema.multipleOf);
                }

                return addMetadata(numberSchema, schema);
            }
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
            case "array": {
                let arraySchema;
                if (schema.items) {
                    arraySchema = z.array(convertJsonSchemaToZod(schema.items));
                } else {
                    arraySchema = z.array(z.any());
                }

                // Apply array-specific constraints
                if (schema.minItems !== undefined) {
                    arraySchema = arraySchema.min(schema.minItems);
                }
                if (schema.maxItems !== undefined) {
                    arraySchema = arraySchema.max(schema.maxItems);
                }
                if (schema.uniqueItems === true) {
                    // To enforce uniqueness, we need a custom refine function
                    // that checks if all elements are unique
                    arraySchema = arraySchema.refine(
                        (items) => {
                            const seen = new Set();
                            return items.every((item) => {
                                // For primitive values, we can use a Set directly
                                if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
                                    if (seen.has(item)) return false;
                                    seen.add(item);
                                    return true;
                                } 
                                // For objects, we'd need more complex comparison
                                // For simplicity, we stringfy objects for comparison
                                const serialized = JSON.stringify(item);
                                if (seen.has(serialized)) return false;
                                seen.add(serialized);
                                return true;
                            });
                        },
                        { message: "Array items must be unique" }
                    );
                }

                return addMetadata(arraySchema, schema);
            }
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
