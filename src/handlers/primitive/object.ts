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

export class ImplicitObjectHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const objectSchema = schema as JSONSchema.ObjectSchema;
        
        // If no explicit type but object constraints are present, enable object type
        if (schema.type === undefined && 
            (objectSchema.maxProperties !== undefined || 
             objectSchema.minProperties !== undefined)) {
            
            if (types.object === undefined) {
                types.object = z.object({}).passthrough();
            }
        }
    }
}

export class MaxPropertiesHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const objectSchema = schema as JSONSchema.ObjectSchema;
        if (objectSchema.maxProperties === undefined) return;

        // Apply constraint when object type is enabled (explicit or implicit)
        if (types.object !== false) {
            const baseObject = types.object || z.object({}).passthrough();
            types.object = baseObject.refine(
                (obj: any) => Object.keys(obj).length <= objectSchema.maxProperties!,
                { message: `Object must have at most ${objectSchema.maxProperties} properties` }
            );
        }
    }
}

export class MinPropertiesHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const objectSchema = schema as JSONSchema.ObjectSchema;
        if (objectSchema.minProperties === undefined) return;

        // Apply constraint when object type is enabled (explicit or implicit)
        if (types.object !== false) {
            const baseObject = types.object || z.object({}).passthrough();
            types.object = baseObject.refine(
                (obj: any) => Object.keys(obj).length >= objectSchema.minProperties!,
                { message: `Object must have at least ${objectSchema.minProperties} properties` }
            );
        }
    }
}