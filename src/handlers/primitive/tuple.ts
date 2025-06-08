import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { PrimitiveHandler, TypeSchemas } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";

export class TupleHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        // Only handle arrays with tuple-style items
        if (schema.type !== "array") return;

        const arraySchema = schema as JSONSchema.ArraySchema;

        // Check if items is an array (tuple definition)
        if (!Array.isArray(arraySchema.items)) return;

        // If array type is already false, skip
        if (types.array === false) return;

        // Convert each item schema to Zod schemas
        const itemSchemas = arraySchema.items.map((itemSchema) => convertJsonSchemaToZod(itemSchema));

        // Create the actual tuple
        let tuple: z.ZodTuple | false;
        if (itemSchemas.length === 0) {
            tuple = z.tuple([]);
        } else {
            tuple = z.tuple(itemSchemas as [z.ZodTypeAny, ...z.ZodTypeAny[]]);
        }

        // Apply constraints
        if (arraySchema.minItems !== undefined && arraySchema.minItems > itemSchemas.length) {
            // Can't satisfy minItems with a fixed-length tuple
            tuple = false;
        }

        if (arraySchema.maxItems !== undefined && arraySchema.maxItems < itemSchemas.length) {
            // Can't satisfy maxItems with a fixed-length tuple
            tuple = false;
        }

        types.tuple = tuple;
        types.array = false;
    }
}
