import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";

export class ObjectPropertiesHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        const objectSchema = schema as JSONSchema.ObjectSchema;
        
        // Skip if no object-specific constraints
        if (!objectSchema.properties && !objectSchema.required && objectSchema.additionalProperties !== false) {
            return zodSchema;
        }

        // Check if the schema is a single object type (not a union)
        if (zodSchema instanceof z.ZodObject || zodSchema instanceof z.ZodRecord) {
            // Build proper shape with converted property schemas
            const shape: Record<string, z.ZodTypeAny> = {};
            
            if (objectSchema.properties) {
                for (const [key, propSchema] of Object.entries(objectSchema.properties)) {
                    if (propSchema !== undefined) {
                        shape[key] = convertJsonSchemaToZod(propSchema);
                    }
                }
            }
            
            // Handle required properties
            if (objectSchema.required && Array.isArray(objectSchema.required)) {
                const required = new Set(objectSchema.required);
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
            
            // Recreate the object with proper shape
            if (objectSchema.additionalProperties === false) {
                return z.object(shape);
            } else {
                return z.object(shape).passthrough();
            }
        }
        
        // For unions or other complex types, use refinement
        return zodSchema.refine(
            (value: any) => {
                // Only apply object constraints to objects
                if (typeof value !== "object" || value === null || Array.isArray(value)) {
                    return true; // Non-objects pass through
                }

                // Apply properties constraint
                if (objectSchema.properties) {
                    for (const [propName, propSchema] of Object.entries(objectSchema.properties)) {
                        if (propSchema !== undefined) {
                            // Use a more robust way to check if property exists
                            // This handles JavaScript special property names correctly
                            const propExists = Object.getOwnPropertyDescriptor(value, propName) !== undefined;
                            
                            if (propExists) {
                                const zodPropSchema = convertJsonSchemaToZod(propSchema);
                                const propResult = zodPropSchema.safeParse(value[propName]);
                                if (!propResult.success) {
                                    return false;
                                }
                            }
                        }
                    }
                }

                // Apply required constraint
                if (objectSchema.required && Array.isArray(objectSchema.required)) {
                    for (const requiredProp of objectSchema.required) {
                        // Use robust property detection for required props too
                        const propExists = Object.getOwnPropertyDescriptor(value, requiredProp) !== undefined;
                        if (!propExists) {
                            return false;
                        }
                    }
                }

                // Apply additionalProperties constraint
                if (objectSchema.additionalProperties === false && objectSchema.properties) {
                    const allowedProps = new Set(Object.keys(objectSchema.properties));
                    for (const prop in value) {
                        if (!allowedProps.has(prop)) {
                            return false;
                        }
                    }
                }

                return true;
            },
            { message: "Object constraints validation failed" }
        );
    }
}