import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import deepEqual from "deep-equal";

/**
 * Converts a JSON Schema object to a Zod schema
 */
export function convertJsonSchemaToZod(schema: JSONSchema.BaseSchema): z.ZodType {
    // Create a helper function to add metadata like description
    function addMetadata(zodSchema: z.ZodTypeAny, jsonSchema: JSONSchema.BaseSchema): z.ZodTypeAny {
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

    // Infer array type from array-specific properties
    if (!schema.type && (schema.items || (schema as any).prefixItems || schema.minItems !== undefined || schema.maxItems !== undefined || (schema as any).uniqueItems !== undefined)) {
        schema = { ...schema, type: "array" };
    }

    // Handle primitive types
    if (schema.type) {
        switch (schema.type) {
            case "string": {
                const s = schema as JSONSchema.StringSchema;

                // Handle enum first if it exists for string type
                if (s.enum) {
                    // Empty enum case, default to string type
                    if (s.enum.length === 0) {
                        return addMetadata(z.string(), s);
                    }

                    // Since we know this is a string type, we can safely cast enum values
                    return addMetadata(z.enum(s.enum as [string, ...string[]]), s);
                }

                let stringSchema = z.string();

                // Apply string-specific constraints
                if (s.minLength !== undefined) {
                    stringSchema = stringSchema.min(s.minLength);
                }
                if (s.maxLength !== undefined) {
                    stringSchema = stringSchema.max(s.maxLength);
                }
                if (s.pattern !== undefined) {
                    const regex = new RegExp(s.pattern);
                    stringSchema = stringSchema.regex(regex);
                }

                return addMetadata(stringSchema, s);
            }
            case "number":
            case "integer": {
                const s = schema as JSONSchema.NumberSchema | JSONSchema.IntegerSchema;

                // Handle enum if it exists for number type
                if (s.enum) {
                    // Empty enum case, default to number type
                    if (s.enum.length === 0) {
                        return addMetadata(z.number(), s);
                    }

                    // For numbers we need a union of literals since z.enum only works with strings
                    const options = s.enum.map((val) => z.literal(val as number));

                    // Handle single option enum specially
                    if (options.length === 1) {
                        return addMetadata(options[0], s);
                    }

                    // For multiple options, create a union
                    if (options.length >= 2) {
                        const unionSchema = z.union([options[0], options[1], ...options.slice(2)]);
                        return addMetadata(unionSchema, s);
                    }
                }

                let numberSchema = s.type === "integer" ? z.number().int() : z.number();

                // Apply number-specific constraints
                if (s.minimum !== undefined) {
                    numberSchema = numberSchema.min(s.minimum);
                }
                if (s.maximum !== undefined) {
                    numberSchema = numberSchema.max(s.maximum);
                }
                if (s.exclusiveMinimum !== undefined) {
                    numberSchema = numberSchema.gt(s.exclusiveMinimum);
                }
                if (s.exclusiveMaximum !== undefined) {
                    numberSchema = numberSchema.lt(s.exclusiveMaximum);
                }
                if (s.multipleOf !== undefined) {
                    numberSchema = numberSchema.multipleOf(s.multipleOf);
                }

                return addMetadata(numberSchema, s);
            }
            case "boolean":
                // Handle enum for boolean type if present
                if (schema.enum) {
                    // Empty enum case, default to boolean type
                    if (schema.enum.length === 0) {
                        return addMetadata(z.boolean(), schema);
                    }

                    const options = schema.enum.map((val) => z.literal(val as boolean));

                    // Handle single option enum specially
                    if (options.length === 1) {
                        return addMetadata(options[0], schema);
                    }

                    // For multiple options, create a union
                    if (options.length >= 2) {
                        const unionSchema = z.union([options[0], options[1], ...options.slice(2)]);
                        return addMetadata(unionSchema, schema);
                    }
                }
                return addMetadata(z.boolean(), schema);
            case "null":
                return addMetadata(z.null(), schema);
            case "object":
                if (schema.properties) {
                    const shape: Record<string, z.ZodTypeAny> = {};

                    // Process each property
                    for (const [key, propSchema] of Object.entries(schema.properties)) {
                        if (propSchema === undefined) continue;
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
                    } else {
                        // In JSON Schema, properties are optional by default
                        // if no required array is specified
                        for (const key of Object.keys(shape)) {
                            shape[key] = shape[key].optional();
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
                const s = schema as JSONSchema.ArraySchema;

                let arraySchema;
                let isTuple = false;

                // Check for prefixItems (Draft 2020-12 tuples)
                if ((s as any).prefixItems && Array.isArray((s as any).prefixItems)) {
                    isTuple = true;
                    const prefixItems = (s as any).prefixItems;
                    const prefixSchemas = prefixItems.map((itemSchema: any) => convertJsonSchemaToZod(itemSchema));

                    // Create a custom array validator for prefixItems behavior
                    arraySchema = z.array(z.any()).refine(
                        (arr: any[]) => {
                            // Validate each present item against its corresponding prefix schema
                            for (let i = 0; i < Math.min(arr.length, prefixSchemas.length); i++) {
                                try {
                                    prefixSchemas[i].parse(arr[i]);
                                } catch {
                                    return false;
                                }
                            }

                            // Handle additional items beyond prefixItems
                            if (arr.length > prefixSchemas.length) {
                                if ((s as any).items === false) {
                                    // No additional items allowed
                                    return false;
                                } else if (s.items && typeof s.items === "object" && !Array.isArray(s.items)) {
                                    // Additional items must match the items schema
                                    const additionalItemSchema = convertJsonSchemaToZod(s.items);
                                    for (let i = prefixSchemas.length; i < arr.length; i++) {
                                        try {
                                            additionalItemSchema.parse(arr[i]);
                                        } catch {
                                            return false;
                                        }
                                    }
                                }
                                // If items is not specified or true, allow any additional items
                            }

                            return true;
                        },
                        { message: "Array does not match prefixItems schema" },
                    );
                } else if (Array.isArray(s.items)) {
                    // Handle tuple arrays - items is an array of schemas (older draft behavior)
                    isTuple = true;
                    const tupleItems = s.items.map((itemSchema) => convertJsonSchemaToZod(itemSchema));
                    
                    if (s.additionalItems === false) {
                        // When additionalItems is false, we need strict tuple validation
                        arraySchema = z.array(z.any()).refine(
                            (arr: any[]) => {
                                // Must have exactly the number of items specified in the tuple
                                if (arr.length !== tupleItems.length) {
                                    return false;
                                }
                                
                                // Validate each item against its corresponding schema
                                for (let i = 0; i < tupleItems.length; i++) {
                                    try {
                                        tupleItems[i].parse(arr[i]);
                                    } catch {
                                        return false;
                                    }
                                }
                                return true;
                            },
                            { message: "Array does not match tuple schema with additionalItems=false" }
                        );
                    } else {
                        // Use regular tuple which allows additional items by default
                        arraySchema = z.tuple(tupleItems as [z.ZodTypeAny, ...z.ZodTypeAny[]]);
                    }
                } else if (s.items) {
                    arraySchema = z.array(convertJsonSchemaToZod(s.items));
                } else {
                    arraySchema = z.array(z.any());
                }

                // Apply array-specific constraints (only for regular arrays, not tuples)
                if (!isTuple) {
                    if (s.minItems !== undefined) {
                        arraySchema = (arraySchema as z.ZodArray<any>).min(s.minItems);
                    }
                    if (s.maxItems !== undefined) {
                        arraySchema = (arraySchema as z.ZodArray<any>).max(s.maxItems);
                    }
                }
                if (s.uniqueItems === true) {
                    // To enforce uniqueness, we need a custom refine function
                    // that checks if all elements are unique
                    arraySchema = arraySchema.refine(
                        (items: any[]) => {
                            const seen: any[] = [];
                            return items.every((item: any) => {
                                // Use deep-equal with strict mode to check if this item already exists in seen array
                                const isDuplicate = seen.some((seenItem: any) => deepEqual(item, seenItem, { strict: true }));
                                if (isDuplicate) {
                                    return false;
                                }
                                seen.push(item);
                                return true;
                            });
                        },
                        { message: "Array items must be unique" },
                    );
                }

                return addMetadata(arraySchema, s);
            }
        }
    }

    // Handle enum (when type is not specified)
    if (schema.enum) {
        // Empty enum case, default to never type for empty enum without type
        // This matches JSON Schema's behavior where an empty enum without type should match nothing
        if (schema.enum.length === 0) {
            return addMetadata(z.never(), schema);
        }

        // Check if all enum values are strings
        const allStrings = schema.enum.every((val) => typeof val === "string");

        if (allStrings) {
            // If all values are strings, use z.enum which is more efficient
            return addMetadata(z.enum(schema.enum as [string, ...string[]]), schema);
        } else {
            // For mixed types or non-strings, use a union of literals
            const options = schema.enum.map((val) => z.literal(val));

            // Handle single option enum specially
            if (options.length === 1) {
                return addMetadata(options[0], schema);
            }

            // For multiple options, create a union
            if (options.length >= 2) {
                const unionSchema = z.union([options[0], options[1], ...options.slice(2)]);
                return addMetadata(unionSchema, schema);
            }
        }
    }

    // Handle combinations
    if (schema.anyOf && schema.anyOf.length >= 2) {
        const schemas = schema.anyOf.map(convertJsonSchemaToZod);
        return addMetadata(z.union([schemas[0], schemas[1], ...schemas.slice(2)]), schema);
    }

    if (schema.allOf) {
        return addMetadata(
            schema.allOf.reduce(
                (acc: z.ZodTypeAny, s: JSONSchema.BaseSchema) => z.intersection(acc, convertJsonSchemaToZod(s)),
                z.object({}),
            ),
            schema,
        );
    }

    if (schema.oneOf && schema.oneOf.length >= 2) {
        const schemas = schema.oneOf.map(convertJsonSchemaToZod);
        return addMetadata(z.union([schemas[0], schemas[1], ...schemas.slice(2)]), schema);
    }

    // Handle not keyword
    if ((schema as any).not) {
        const notSchema = convertJsonSchemaToZod((schema as any).not);
        return addMetadata(
            z.any().refine(
                (value: any) => !notSchema.safeParse(value).success,
                { message: "Value must not match the 'not' schema" }
            ),
            schema
        );
    }

    // Handle uniqueItems constraint (applies to any schema that might be an array)
    // Only apply this general handler if we haven't already handled arrays specifically
    if ((schema as any).uniqueItems === true && schema.type !== "array") {
        return addMetadata(
            z.any().refine(
                (value: any) => {
                    // Only apply uniqueItems validation to arrays
                    if (!Array.isArray(value)) {
                        return true; // Non-arrays are valid
                    }
                    
                    const seen: any[] = [];
                    return value.every((item: any) => {
                        // Use deep-equal with strict mode to check if this item already exists in seen array
                        const isDuplicate = seen.some((seenItem: any) => deepEqual(item, seenItem, { strict: true }));
                        if (isDuplicate) {
                            return false;
                        }
                        seen.push(item);
                        return true;
                    });
                },
                { message: "Array items must be unique" }
            ),
            schema
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
export function jsonSchemaObjectToZodRawShape(schema: JSONSchema.Schema): z.ZodRawShape {
    const raw: Record<string, z.ZodType> = {};
    for (const [key, value] of Object.entries(schema.properties ?? {})) {
        if (value === undefined) continue;
        raw[key] = convertJsonSchemaToZod(value);
    }
    return raw;
}
