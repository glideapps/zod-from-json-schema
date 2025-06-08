import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { PrimitiveHandler, TypeSchemas } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";

export class ImplicitArrayHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const arraySchema = schema as JSONSchema.ArraySchema;
        
        // If no explicit type but array constraints are present, enable array type
        if (schema.type === undefined && 
            (arraySchema.minItems !== undefined || 
             arraySchema.maxItems !== undefined || 
             arraySchema.items !== undefined || 
             (arraySchema as any).prefixItems !== undefined)) {
            
            if (types.array === undefined) {
                types.array = z.array(z.any());
            }
        }
    }
}

export class MinItemsHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const arraySchema = schema as JSONSchema.ArraySchema;
        if (arraySchema.minItems === undefined) return;

        // Apply constraint when array type is enabled (explicit or implicit)
        if (types.array !== false) {
            types.array = (types.array || z.array(z.any())).min(arraySchema.minItems);
        }
    }
}

export class MaxItemsHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const arraySchema = schema as JSONSchema.ArraySchema;
        if (arraySchema.maxItems === undefined) return;

        // Apply constraint when array type is enabled (explicit or implicit)
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
        
        // Handle tuple arrays (items as array) - now handled by TupleHandler
        if (Array.isArray(arraySchema.items)) {
            // TupleHandler will handle this, just create a base array
            types.array = types.array || z.array(z.any());
        } 
        // Handle simple items schema (non-boolean, non-array, no prefixItems)
        else if (arraySchema.items && 
                 typeof arraySchema.items !== "boolean" && 
                 !(arraySchema as any).prefixItems) {
            
            // Convert the item schema and create the typed array
            const itemSchema = convertJsonSchemaToZod(arraySchema.items);
            let newArray = z.array(itemSchema);
            
            // Apply existing min/max constraints if we already had an array
            if (types.array && types.array instanceof z.ZodArray) {
                const existingDef = (types.array as any)._def;
                // Check for existing constraints in the checks array
                if (existingDef.checks) {
                    existingDef.checks.forEach((check: any) => {
                        if (check._zod && check._zod.def) {
                            const def = check._zod.def;
                            if (def.check === 'min_length' && def.minimum !== undefined) {
                                newArray = newArray.min(def.minimum);
                            } else if (def.check === 'max_length' && def.maximum !== undefined) {
                                newArray = newArray.max(def.maximum);
                            }
                        }
                    });
                }
            }
            
            types.array = newArray;
        }
        // Handle boolean items
        else if (typeof arraySchema.items === "boolean" && arraySchema.items === false) {
            // items: false means only empty arrays are allowed (unless overridden by prefixItems)
            if (!(arraySchema as any).prefixItems) {
                types.array = z.array(z.any()).max(0); // Only empty arrays
            } else {
                types.array = types.array || z.array(z.any());
            }
        }
        else if (typeof arraySchema.items === "boolean" && arraySchema.items === true) {
            // items: true means any items are allowed
            types.array = types.array || z.array(z.any());
        }
        // Handle prefixItems without items
        else if ((arraySchema as any).prefixItems) {
            types.array = types.array || z.array(z.any());
        }
    }
}