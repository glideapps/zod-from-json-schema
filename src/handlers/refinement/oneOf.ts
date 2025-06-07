import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";

export class OneOfHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        if (!schema.oneOf || schema.oneOf.length === 0) return zodSchema;

        const oneOfSchema =
            schema.oneOf.length === 1
                ? convertJsonSchemaToZod(schema.oneOf[0])
                : z.union([
                      convertJsonSchemaToZod(schema.oneOf[0]),
                      convertJsonSchemaToZod(schema.oneOf[1]),
                      ...schema.oneOf.slice(2).map(s => convertJsonSchemaToZod(s))
                  ]);

        // Intersect with base schema to preserve existing constraints
        return z.intersection(zodSchema, oneOfSchema);
    }
}