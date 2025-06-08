import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { createUniqueItemsValidator } from "../../core/utils";

export class UniqueItemsHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        const arraySchema = schema as JSONSchema.ArraySchema;
        if (arraySchema.uniqueItems !== true) return zodSchema;

        return zodSchema.refine(createUniqueItemsValidator(), {
            message: "Array items must be unique"
        });
    }
}