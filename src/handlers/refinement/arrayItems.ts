import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";
import { isValidWithSchema } from "../../core/utils";

export class ArrayItemsHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        const arraySchema = schema as JSONSchema.ArraySchema;
        
        // Check if the schema is a single array type (not a union)
        if (zodSchema instanceof z.ZodArray) {
            // Handle simple items schema ONLY if there's no prefixItems or tuple items
            if (arraySchema.items && !Array.isArray(arraySchema.items) && arraySchema.items !== false 
                && !(arraySchema as any).prefixItems) {
                const itemSchema = convertJsonSchemaToZod(arraySchema.items);
                let newArray = z.array(itemSchema);
                
                // Apply min/max constraints from the JSON schema
                if (arraySchema.minItems !== undefined) {
                    newArray = newArray.min(arraySchema.minItems);
                }
                if (arraySchema.maxItems !== undefined) {
                    newArray = newArray.max(arraySchema.maxItems);
                }
                
                return newArray;
            }
        }
        
        // For complex array schemas or unions, use refinement
        // Check for prefixItems (Draft 2020-12 tuples)
        if ((arraySchema as any).prefixItems && Array.isArray((arraySchema as any).prefixItems)) {
            const prefixItems = (arraySchema as any).prefixItems;
            const prefixSchemas = prefixItems.map((itemSchema: any) => convertJsonSchemaToZod(itemSchema));

            return zodSchema.refine(
                (value: any) => {
                    if (!Array.isArray(value)) return true; // Non-arrays pass through
                    
                    // Validate each present item against its corresponding prefix schema
                    for (let i = 0; i < Math.min(value.length, prefixSchemas.length); i++) {
                        if (!isValidWithSchema(prefixSchemas[i], value[i])) {
                            return false;
                        }
                    }

                    // Handle additional items beyond prefixItems
                    if (value.length > prefixSchemas.length) {
                        if (arraySchema.items === false) {
                            return false; // No additional items allowed
                        } else if (arraySchema.items && typeof arraySchema.items === "object" && !Array.isArray(arraySchema.items)) {
                            const additionalItemSchema = convertJsonSchemaToZod(arraySchema.items);
                            for (let i = prefixSchemas.length; i < value.length; i++) {
                                if (!isValidWithSchema(additionalItemSchema, value[i])) {
                                    return false;
                                }
                            }
                        }
                    }
                    return true;
                },
                { message: "Array does not match prefixItems schema" }
            );
        } else if (arraySchema.items !== undefined) {
            if (Array.isArray(arraySchema.items)) {
                // Tuple validation
                const tupleItems = arraySchema.items.map(itemSchema => convertJsonSchemaToZod(itemSchema));

                return zodSchema.refine(
                    (value: any) => {
                        if (!Array.isArray(value)) return true; // Non-arrays pass through
                        
                        // Check tuple items
                        for (let i = 0; i < tupleItems.length; i++) {
                            // If array is shorter than tuple definition, it's invalid
                            if (i >= value.length) {
                                return false;
                            }
                            // Validate the item at this position
                            if (!isValidWithSchema(tupleItems[i], value[i])) {
                                return false;
                            }
                        }
                        
                        // Handle additional items beyond the tuple definition
                        if (value.length > tupleItems.length) {
                            // When items is an array (tuple), the default for additionalItems is false
                            // Only allow additional items if additionalItems is explicitly true or a schema
                            if (arraySchema.additionalItems === undefined || arraySchema.additionalItems === false) {
                                return false;
                            } else if (arraySchema.additionalItems === true) {
                                // Any additional items are allowed
                                return true;
                            } else if (typeof arraySchema.additionalItems === "object") {
                                // additionalItems is a schema - validate extra items against it
                                const additionalItemSchema = convertJsonSchemaToZod(arraySchema.additionalItems);
                                for (let i = tupleItems.length; i < value.length; i++) {
                                    if (!isValidWithSchema(additionalItemSchema, value[i])) {
                                        return false;
                                    }
                                }
                            }
                        }
                        
                        return true;
                    },
                    { message: "Array does not match tuple schema" }
                );
            } else if (arraySchema.items !== false && zodSchema instanceof z.ZodArray) {
                // Single schema for all items - already handled above
                const itemSchema = convertJsonSchemaToZod(arraySchema.items);
                return z.array(itemSchema);
            }
        }
        
        return zodSchema;
    }
}