import { z } from "zod";

/**
 * Type representing a JSON Schema object
 */
export type JSONSchema = {
    $schema?: string;
    type?: string;
    properties?: Record<string, JSONSchema>;
    required?: string[];
    additionalProperties?: boolean;
    items?: JSONSchema;
    enum?: Array<string | number | boolean | null>;
    const?: any;
    description?: string;
    anyOf?: JSONSchema[];
    allOf?: JSONSchema[];
    oneOf?: JSONSchema[];
    // String validations
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    // Number validations
    minimum?: number;
    maximum?: number;
    exclusiveMinimum?: number;
    exclusiveMaximum?: number;
    multipleOf?: number;
    // Array validations
    minItems?: number;
    maxItems?: number;
    uniqueItems?: boolean;
};

/**
 * Converts a JSON Schema object to a Zod schema
 */
export function convertJsonSchemaToZod(schema: JSONSchema): z.ZodTypeAny {
    // Create a helper function to add metadata like description
    function addMetadata(
        zodSchema: z.ZodTypeAny,
        jsonSchema: JSONSchema,
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
                    let zodSchema: z.ZodTypeAny;
                    
                    // By default, JSON Schema allows additional properties, so use passthrough
                    // unless additionalProperties is explicitly set to false
                    if (schema.additionalProperties !== false) {
                        zodSchema = z.object(shape).passthrough();
                    } else {
                        zodSchema = z.object(shape);
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
        // Ensure enum values are strings for Zod enum compatibility
        const enumValues = schema.enum.map(val => String(val));
        return addMetadata(z.enum(enumValues as [string, ...string[]]), schema);
    }

    // Handle combinations
    if (schema.anyOf && schema.anyOf.length >= 2) {
        const schemas = schema.anyOf.map(convertJsonSchemaToZod);
        return addMetadata(
            z.union([schemas[0], schemas[1], ...schemas.slice(2)]),
            schema,
        );
    }

    if (schema.allOf) {
        return addMetadata(
            schema.allOf.reduce(
                (acc: z.ZodTypeAny, s: JSONSchema) =>
                    z.intersection(acc, convertJsonSchemaToZod(s)),
                z.object({}),
            ),
            schema,
        );
    }

    if (schema.oneOf && schema.oneOf.length >= 2) {
        const schemas = schema.oneOf.map(convertJsonSchemaToZod);
        return addMetadata(
            z.union([schemas[0], schemas[1], ...schemas.slice(2)]),
            schema,
        );
    }

    // Default fallback
    return addMetadata(z.any(), schema);
}

/**
 * Converts a JSON Schema object to a Zod raw shape
 * @param schema The JSON Schema object to convert
 * @returns A Zod raw shape for use with z.object()
 */
export function jsonSchemaObjectToZodRawShape(schema: JSONSchema): z.ZodRawShape {
    let raw: z.ZodRawShape = {};
    for (const [key, value] of Object.entries(schema.properties ?? {})) {
        raw[key] = convertJsonSchemaToZod(value);
    }
    return raw;
}
