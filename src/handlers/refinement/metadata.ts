import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";

export class MetadataHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        if (schema.description) {
            zodSchema = zodSchema.describe(schema.description);
        }
        return zodSchema;
    }
}