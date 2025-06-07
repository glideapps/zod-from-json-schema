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
        
        // For now, we'll skip complex array validation in primitive handlers
        // These will be handled by refinement handlers
        if (arraySchema.items !== undefined || (arraySchema as any).prefixItems) {
            // Just ensure array type is set if not already false
            if (types.array === undefined) {
                types.array = z.array(z.any());
            }
        }
    }
}