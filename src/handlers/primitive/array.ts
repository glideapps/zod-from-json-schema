import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { PrimitiveHandler, TypeSchemas } from "../../core/types";

export class MinItemsHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const arraySchema = schema as JSONSchema.ArraySchema;
        if (arraySchema.minItems === undefined) return;

        if (types.array !== false) {
            types.array = (types.array || z.array(z.any())).min(arraySchema.minItems);
        }
    }
}

export class MaxItemsHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const arraySchema = schema as JSONSchema.ArraySchema;
        if (arraySchema.maxItems === undefined) return;

        if (types.array !== false) {
            types.array = (types.array || z.array(z.any())).max(arraySchema.maxItems);
        }
    }
}

export class ItemsHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const arraySchema = schema as JSONSchema.ArraySchema;
        
        // Skip if array is already disallowed
        if (types.array === false) return;
        
        // Handle tuple arrays (items as array)
        if (Array.isArray(arraySchema.items)) {
            // We need to create a base array schema that will be refined later
            // For now just ensure we have an array type
            types.array = types.array || z.array(z.any());
        } 
        // Handle regular items schema
        else if (arraySchema.items !== undefined) {
            types.array = types.array || z.array(z.any());
        }
        // Handle prefixItems
        else if ((arraySchema as any).prefixItems) {
            types.array = types.array || z.array(z.any());
        }
    }
}