import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";

export class DefaultHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        const { default: v } = schema;

        if (v === undefined) return zodSchema;
        if (!zodSchema.safeParse(v).success) {
            // should we error-log here?
            return zodSchema;
        }

        return zodSchema.default(v);
    }
}
