import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import deepEqual from "deep-equal";

/**
 * Creates a uniqueItems validation function - SINGLE SOURCE OF TRUTH
 */
function createUniqueItemsValidator() {
    return (value: any) => {
        if (!Array.isArray(value)) {
            return true;
        }
        
        const seen: any[] = [];
        return value.every((item: any) => {
            const isDuplicate = seen.some((seenItem: any) =>
                deepEqual(item, seenItem, { strict: true })
            );
            if (isDuplicate) {
                return false;
            }
            seen.push(item);
            return true;
        });
    };
}

/**
 * Applies array constraints (uniqueItems, minItems, maxItems, etc.) to any schema
 * This is the SINGLE PLACE where array constraints are applied
 */
function applyArrayConstraints(baseSchema: z.ZodTypeAny, schema: JSONSchema.ArraySchema): z.ZodTypeAny {
    let result = baseSchema;
    
    // Apply uniqueItems constraint
    if (schema.uniqueItems === true) {
        result = result.refine(
            createUniqueItemsValidator(),
            { message: "Array items must be unique" }
        );
    }
    
    return result;
}

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

    // Handle const values - these override everything else
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

    // Type inference - be very conservative, only infer when absolutely necessary
    let effectiveType = schema.type;
    // Don't infer types from constraint properties - let them be applied conditionally

    // Determine base schema
    let baseSchema: z.ZodTypeAny;

    // Handle enum first, as it can override type-based schemas
    if (schema.enum) {
        if (schema.enum.length === 0) {
            baseSchema = effectiveType ? createBaseTypeSchema(effectiveType, schema) : z.never();
        } else {
            // Check if all enum values are strings
            const allStrings = schema.enum.every((val) => typeof val === "string");
            if (allStrings) {
                baseSchema = z.enum(schema.enum as [string, ...string[]]);
            } else {
                // For mixed types or non-strings, use a union of literals
                const options = schema.enum.map((val) => z.literal(val));
                if (options.length === 1) {
                    baseSchema = options[0];
                } else {
                    baseSchema = z.union([options[0], options[1], ...options.slice(2)]);
                }
            }
        }
    }
    // Handle schema combinations
    else if (schema.anyOf && schema.anyOf.length >= 2) {
        // For anyOf, each alternative should be combined with the base schema
        if (effectiveType) {
            const combinedSchemas = schema.anyOf.map((anyOfItem) =>
                convertJsonSchemaToZod({ ...schema, anyOf: undefined, ...anyOfItem }),
            );
            baseSchema = z.union([combinedSchemas[0], combinedSchemas[1], ...combinedSchemas.slice(2)]);
        } else {
            const schemas = schema.anyOf.map(convertJsonSchemaToZod);
            baseSchema = z.union([schemas[0], schemas[1], ...schemas.slice(2)]);
        }
    } else if (schema.allOf) {
        baseSchema = schema.allOf.reduce(
            (acc: z.ZodTypeAny, s: JSONSchema.BaseSchema) => z.intersection(acc, convertJsonSchemaToZod(s)),
            z.object({}),
        );
    } else if (schema.oneOf && schema.oneOf.length >= 2) {
        // For oneOf, each alternative should be combined with the base schema
        if (effectiveType) {
            const combinedSchemas = schema.oneOf.map((oneOfItem) =>
                convertJsonSchemaToZod({ ...schema, oneOf: undefined, ...oneOfItem }),
            );
            baseSchema = z.union([combinedSchemas[0], combinedSchemas[1], ...combinedSchemas.slice(2)]);
        } else {
            const schemas = schema.oneOf.map(convertJsonSchemaToZod);
            baseSchema = z.union([schemas[0], schemas[1], ...schemas.slice(2)]);
        }
    }
    // Handle type-based schemas
    else if (effectiveType) {
        baseSchema = createBaseTypeSchema(effectiveType, schema);
    }
    // Default fallback
    else {
        baseSchema = z.any();
    }

    // Apply constraints that can be applied to any schema type

    // Apply 'not' constraint
    if ((schema as any).not) {
        const notSchema = convertJsonSchemaToZod((schema as any).not);
        baseSchema = z
            .any()
            .refine((value: any) => !notSchema.safeParse(value).success, {
                message: "Value must not match the 'not' schema",
            });
    }

    // Apply conditional constraints for schemas without explicit type
    if (!effectiveType) {
        // Apply array-specific constraints conditionally
        const s = schema as JSONSchema.ArraySchema;
        if (
            s.items ||
            (s as any).prefixItems ||
            s.minItems !== undefined ||
            s.maxItems !== undefined ||
            (s as any).uniqueItems === true
        ) {
            baseSchema = baseSchema.refine(
                (value: any) => {
                    // Only apply array constraints to arrays
                    if (!Array.isArray(value)) {
                        return true; // Non-arrays are valid
                    }

                    // Handle different items scenarios explicitly
                    let itemsValidationPassed = true;

                    // Case 1: items is a single schema (all items must match this schema)
                    // Note: if prefixItems is present, items only applies to additional items beyond prefixItems
                    if (s.items && !Array.isArray(s.items) && !(s as any).prefixItems) {
                        const itemSchema = convertJsonSchemaToZod(s.items);
                        for (const item of value) {
                            if (!itemSchema.safeParse(item).success) {
                                itemsValidationPassed = false;
                                break;
                            }
                        }
                    }
                    // Case 2: items is an array (tuple validation)
                    else if (Array.isArray(s.items)) {
                        const tupleSchemas = s.items.map((itemSchema) => convertJsonSchemaToZod(itemSchema));

                        // Check length constraint for additionalItems: false
                        if (s.additionalItems === false && value.length !== tupleSchemas.length) {
                            itemsValidationPassed = false;
                        } else {
                            // Validate each position against its corresponding schema
                            for (let i = 0; i < tupleSchemas.length && i < value.length; i++) {
                                if (!tupleSchemas[i].safeParse(value[i]).success) {
                                    itemsValidationPassed = false;
                                    break;
                                }
                            }
                        }
                    }

                    // If items validation failed, return false immediately
                    if (!itemsValidationPassed) {
                        return false;
                    }

                    // Apply prefixItems constraint
                    if ((s as any).prefixItems && Array.isArray((s as any).prefixItems)) {
                        const prefixItems = (s as any).prefixItems;

                        // Validate each item against its corresponding prefix schema
                        for (let i = 0; i < Math.min(value.length, prefixItems.length); i++) {
                            const prefixSchema = convertJsonSchemaToZod(prefixItems[i]);
                            if (!prefixSchema.safeParse(value[i]).success) {
                                return false;
                            }
                        }

                        // Handle additional items beyond prefixItems
                        if (value.length > prefixItems.length) {
                            if ((s as any).items === false) {
                                // No additional items allowed
                                return false;
                            } else if (s.items && typeof s.items === "object" && !Array.isArray(s.items)) {
                                // Additional items must match the items schema
                                const additionalItemSchema = convertJsonSchemaToZod(s.items);
                                for (let i = prefixItems.length; i < value.length; i++) {
                                    if (!additionalItemSchema.safeParse(value[i]).success) {
                                        return false;
                                    }
                                }
                            }
                            // If items is not specified or true, allow any additional items
                        }
                    }

                    // Apply length constraints
                    if (s.minItems !== undefined && value.length < s.minItems) {
                        return false;
                    }
                    if (s.maxItems !== undefined && value.length > s.maxItems) {
                        return false;
                    }

                    // All constraints passed
                    return true;
                },
                { message: "Array constraints validation failed" },
            );
            
            // Apply uniqueItems constraint using centralized function
            baseSchema = applyArrayConstraints(baseSchema, s);
        }

        // Apply object-specific constraints conditionally
        const objSchema = schema as JSONSchema.ObjectSchema;
        if (objSchema.properties || objSchema.required || objSchema.additionalProperties !== undefined) {
            baseSchema = baseSchema.refine(
                (value: any) => {
                    // Only apply object constraints to objects
                    if (typeof value !== "object" || value === null || Array.isArray(value)) {
                        return true; // Non-objects are valid
                    }

                    // Apply properties constraint (only validate own properties that exist)
                    if (objSchema.properties) {
                        for (const [propName, propSchema] of Object.entries(objSchema.properties)) {
                            if (Object.prototype.hasOwnProperty.call(value, propName) && propSchema !== undefined) {
                                const zodPropSchema = convertJsonSchemaToZod(propSchema);
                                if (!zodPropSchema.safeParse(value[propName]).success) {
                                    return false;
                                }
                            }
                        }
                    }

                    // Apply required constraint
                    if (objSchema.required && Array.isArray(objSchema.required)) {
                        for (const requiredProp of objSchema.required) {
                            if (!Object.prototype.hasOwnProperty.call(value, requiredProp)) {
                                return false;
                            }
                        }
                    }

                    // Apply additionalProperties constraint
                    if (objSchema.additionalProperties === false && objSchema.properties) {
                        const allowedProps = new Set(Object.keys(objSchema.properties));
                        for (const prop in value) {
                            if (!allowedProps.has(prop)) {
                                return false;
                            }
                        }
                    }

                    return true;
                },
                { message: "Object constraints validation failed" },
            );
        }
    }

    // Note: uniqueItems for explicit array types is handled in createBaseTypeSchema

    return addMetadata(baseSchema, schema);
}

/**
 * Creates a base type schema for the given type
 */
function createBaseTypeSchema(type: string, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
    switch (type) {
        case "string": {
            const s = schema as JSONSchema.StringSchema;
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

            return stringSchema;
        }
        case "number":
        case "integer": {
            const s = schema as JSONSchema.NumberSchema | JSONSchema.IntegerSchema;
            let numberSchema = type === "integer" ? z.number().int() : z.number();

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

            return numberSchema;
        }
        case "boolean":
            return z.boolean();
        case "null":
            return z.null();
        case "object": {
            if (schema.properties) {
                const shape: Record<string, z.ZodTypeAny> = {};

                // Process each property
                for (const [key, propSchema] of Object.entries(schema.properties)) {
                    if (propSchema === undefined) continue;
                    shape[key] = convertJsonSchemaToZod(propSchema);
                }

                // Handle required properties
                if (schema.required && Array.isArray(schema.required)) {
                    const required = new Set(schema.required);
                    for (const key of Object.keys(shape)) {
                        if (!required.has(key)) {
                            shape[key] = shape[key].optional();
                        }
                    }
                } else {
                    // In JSON Schema, properties are optional by default
                    for (const key of Object.keys(shape)) {
                        shape[key] = shape[key].optional();
                    }
                }

                // Handle additionalProperties
                if (schema.additionalProperties !== false) {
                    return z.object(shape).passthrough();
                } else {
                    return z.object(shape);
                }
            }
            return z.object({});
        }
        case "array": {
            const s = schema as JSONSchema.ArraySchema;
            let arraySchema: z.ZodTypeAny;
            let isTuple = false;

            // Check for prefixItems (Draft 2020-12 tuples)
            if ((s as any).prefixItems && Array.isArray((s as any).prefixItems)) {
                isTuple = true;
                const prefixItems = (s as any).prefixItems;
                const prefixSchemas = prefixItems.map((itemSchema: any) => convertJsonSchemaToZod(itemSchema));

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
                                return false;
                            } else if (s.items && typeof s.items === "object" && !Array.isArray(s.items)) {
                                const additionalItemSchema = convertJsonSchemaToZod(s.items);
                                for (let i = prefixSchemas.length; i < arr.length; i++) {
                                    try {
                                        additionalItemSchema.parse(arr[i]);
                                    } catch {
                                        return false;
                                    }
                                }
                            }
                        }
                        return true;
                    },
                    { message: "Array does not match prefixItems schema" },
                );
            } else if (Array.isArray(s.items)) {
                // Handle tuple arrays - items is an array of schemas
                isTuple = true;
                const tupleItems = s.items.map((itemSchema) => convertJsonSchemaToZod(itemSchema));

                if (s.additionalItems === false) {
                    arraySchema = z.array(z.any()).refine(
                        (arr: any[]) => {
                            if (arr.length !== tupleItems.length) {
                                return false;
                            }
                            for (let i = 0; i < tupleItems.length; i++) {
                                try {
                                    tupleItems[i].parse(arr[i]);
                                } catch {
                                    return false;
                                }
                            }
                            return true;
                        },
                        { message: "Array does not match tuple schema with additionalItems=false" },
                    );
                } else {
                    arraySchema = z.tuple(tupleItems as [z.ZodTypeAny, ...z.ZodTypeAny[]]);
                }
            } else if (s.items) {
                arraySchema = z.array(convertJsonSchemaToZod(s.items));
            } else {
                arraySchema = z.array(z.any());
            }

            // Apply array-specific constraints (only for non-tuples)
            if (!isTuple) {
                if (s.minItems !== undefined) {
                    arraySchema = (arraySchema as z.ZodArray<any>).min(s.minItems);
                }
                if (s.maxItems !== undefined) {
                    arraySchema = (arraySchema as z.ZodArray<any>).max(s.maxItems);
                }
            }

            // Apply array constraints using centralized function
            arraySchema = applyArrayConstraints(arraySchema, s);

            return arraySchema;
        }
        default:
            return z.any();
    }
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
