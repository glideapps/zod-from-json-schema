import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";

export class TupleItemsHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        // Only handle arrays with tuple-style items
        if (schema.type !== "array") return zodSchema;

        const arraySchema = schema as JSONSchema.ArraySchema;

        // Check if items is an array (tuple definition)
        if (!Array.isArray(arraySchema.items)) return zodSchema;

        // Check if this is a tuple placeholder (or if we should create one)
        if (
            zodSchema instanceof z.ZodTuple ||
            (zodSchema instanceof z.ZodUnion && zodSchema.def.options.some((o: any) => o instanceof z.ZodTuple))
        ) {
            // Convert each item schema
            const itemSchemas = arraySchema.items.map((itemSchema) => convertJsonSchemaToZod(itemSchema));

            // Create the actual tuple
            let tuple: z.ZodTypeAny;
            if (itemSchemas.length === 0) {
                tuple = z.tuple([]);
            } else {
                tuple = z.tuple(itemSchemas as [z.ZodTypeAny, ...z.ZodTypeAny[]]);
            }

            // Apply constraints
            if (arraySchema.minItems !== undefined && arraySchema.minItems > itemSchemas.length) {
                // Can't satisfy minItems with a fixed-length tuple
                return z.never();
            }

            if (arraySchema.maxItems !== undefined && arraySchema.maxItems < itemSchemas.length) {
                // Can't satisfy maxItems with a fixed-length tuple
                return z.never();
            }

            // If it was in a union, replace the placeholder
            if (zodSchema instanceof z.ZodUnion) {
                const options = zodSchema.def.options.map((o: any) => (o instanceof z.ZodTuple ? tuple : o));
                return z.union(options as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
            }

            return tuple;
        }

        return zodSchema;
    }
}
