import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { PrimitiveHandler, TypeSchemas } from "../../core/types";

export class PropertiesHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const objectSchema = schema as JSONSchema.ObjectSchema;
        
        // Only process if object is still allowed
        if (types.object === false) return;
        
        // If object has properties, required, or additionalProperties defined, 
        // we need to create a proper object schema
        if (objectSchema.properties || objectSchema.required || objectSchema.additionalProperties !== undefined) {
            const shape: Record<string, z.ZodTypeAny> = {};
            
            if (objectSchema.properties) {
                // We need to defer property conversion to avoid circular dependencies
                // For now, just mark that we have properties
                Object.keys(objectSchema.properties).forEach(key => {
                    shape[key] = z.any(); // Placeholder - will be refined later
                });
            }
            
            // Create the object schema
            if (objectSchema.additionalProperties === false) {
                types.object = z.object(shape);
            } else {
                types.object = z.object(shape).passthrough();
            }
        }
    }
}