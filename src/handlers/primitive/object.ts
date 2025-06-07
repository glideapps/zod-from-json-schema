import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { PrimitiveHandler, TypeSchemas } from "../../core/types";

export class PropertiesHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const objectSchema = schema as JSONSchema.ObjectSchema;
        
        // Only process if object is still allowed
        if (types.object === false) return;
        
        // If object has object-specific constraints, just ensure we have an object type
        // The actual property validation will be handled in the refinement phase
        if (objectSchema.properties || objectSchema.required || objectSchema.additionalProperties !== undefined) {
            // Just create a passthrough object - refinement handler will add constraints
            types.object = types.object || z.object({}).passthrough();
        }
    }
}