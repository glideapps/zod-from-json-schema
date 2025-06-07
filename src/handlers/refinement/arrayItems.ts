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
            // Handle simple items schema
            if (arraySchema.items && !Array.isArray(arraySchema.items) && arraySchema.items !== false) {
                const itemSchema = convertJsonSchemaToZod(arraySchema.items);
                let newArray = z.array(itemSchema);
                
                // Preserve min/max constraints from the original schema
                const originalSchema = zodSchema as z.ZodArray<any>;
                if ((originalSchema as any)._def.minLength !== null && (originalSchema as any)._def.minLength !== undefined) {
                    newArray = newArray.min((originalSchema as any)._def.minLength.value);
                }
                if ((originalSchema as any)._def.maxLength !== null && (originalSchema as any)._def.maxLength !== undefined) {
                    newArray = newArray.max((originalSchema as any)._def.maxLength.value);
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

                if (arraySchema.additionalItems === false) {
                    // For tuple with no additional items, we can use Zod's tuple if schema is simple array
                    if (zodSchema instanceof z.ZodArray) {
                        return z.tuple(tupleItems as [z.ZodTypeAny, ...z.ZodTypeAny[]]).length(tupleItems.length);
                    }
                }

                return zodSchema.refine(
                    (value: any) => {
                        if (!Array.isArray(value)) return true; // Non-arrays pass through
                        
                        if (arraySchema.additionalItems === false && value.length !== tupleItems.length) {
                            return false;
                        }
                        
                        for (let i = 0; i < tupleItems.length && i < value.length; i++) {
                            if (!isValidWithSchema(tupleItems[i], value[i])) {
                                return false;
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