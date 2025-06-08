import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";

export class AnyOfHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        if (!schema.anyOf || schema.anyOf.length === 0) return zodSchema;

        const anyOfSchema =
            schema.anyOf.length === 1
                ? convertJsonSchemaToZod(schema.anyOf[0])
                : z.union([
                      convertJsonSchemaToZod(schema.anyOf[0]),
                      convertJsonSchemaToZod(schema.anyOf[1]),
                      ...schema.anyOf.slice(2).map(s => convertJsonSchemaToZod(s))
                  ]);

        // Intersect with base schema to preserve existing constraints
        return z.intersection(zodSchema, anyOfSchema);
    }
}