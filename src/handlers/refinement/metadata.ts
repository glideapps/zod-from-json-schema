import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { ConversionOptions, RefinementHandler } from "../../core/types";

export class MetadataHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema, options: ConversionOptions): z.ZodTypeAny {
        if (schema.description) {
            zodSchema = zodSchema.describe(schema.description);
        }
        const meta = options.metaForSchema?.(schema);
        if (meta !== undefined && Object.keys(meta).length > 0) {
            zodSchema = zodSchema.meta(meta);
        }
        return zodSchema;
    }
}
