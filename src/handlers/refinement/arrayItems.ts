import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";
import { isValidWithSchema } from "../../core/utils";

export class PrefixItemsHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        const arraySchema = schema as JSONSchema.ArraySchema;

        // Only handle prefixItems (Draft 2020-12 tuples with additional items)
        if ((arraySchema as any).prefixItems && Array.isArray((arraySchema as any).prefixItems)) {
            const prefixItems = (arraySchema as any).prefixItems;
            const prefixSchemas = prefixItems.map((itemSchema: any) => convertJsonSchemaToZod(itemSchema));

            // Convert the additional-items schema eagerly: converting inside
            // the refine closure would run at parse time, after the ref
            // resolution context for this document is gone, so $refs in
            // `items` would silently dangle and become permissive.
            const additionalItemSchema =
                arraySchema.items && typeof arraySchema.items === "object" && !Array.isArray(arraySchema.items)
                    ? convertJsonSchemaToZod(arraySchema.items)
                    : undefined;

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
                        if (typeof arraySchema.items === "boolean" && arraySchema.items === false) {
                            return false; // No additional items allowed
                        } else if (additionalItemSchema !== undefined) {
                            for (let i = prefixSchemas.length; i < value.length; i++) {
                                if (!isValidWithSchema(additionalItemSchema, value[i])) {
                                    return false;
                                }
                            }
                        }
                    }
                    return true;
                },
                { message: "Array does not match prefixItems schema" },
            );
        }

        return zodSchema;
    }
}
