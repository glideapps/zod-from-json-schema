import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";

export class EmptyEnumHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        // Handle empty enum special case
        if (schema.enum && schema.enum.length === 0) {
            if (!schema.type) {
                // Empty enum without type rejects everything
                return z.never();
            }
            // Empty enum with type allows that type (enum:[] is interpreted as no enum constraint)
            return zodSchema;
        }
        return zodSchema;
    }
}