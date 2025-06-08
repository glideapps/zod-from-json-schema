import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { deepEqual } from "../../core/utils";

export class ConstComplexHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        if (schema.const === undefined) return zodSchema;

        const constValue = schema.const;

        // Only handle complex const values (arrays and objects)
        if (typeof constValue !== "object" || constValue === null) {
            return zodSchema;
        }

        // Add refinement to check for exact match
        return zodSchema.refine(
            (value: any) => deepEqual(value, constValue),
            { message: "Value must equal the const value" }
        );
    }
}