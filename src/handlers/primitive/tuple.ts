import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { PrimitiveHandler, TypeSchemas } from "../../core/types";

export class TupleHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        // Only handle arrays with tuple-style items
        if (schema.type !== "array") return;
        
        const arraySchema = schema as JSONSchema.ArraySchema;
        
        // Check if items is an array (tuple definition)
        if (!Array.isArray(arraySchema.items)) return;
        
        // If array type is already false, skip
        if (types.array === false) return;
        
        // Mark that this is a tuple, not a regular array
        // Use a marker that will be replaced in the refinement phase
        types.tuple = z.tuple([]) as any; // Placeholder that will be replaced
        types.array = false;
    }
}