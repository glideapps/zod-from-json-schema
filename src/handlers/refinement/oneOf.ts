import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";

export class OneOfHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        if (!schema.oneOf || schema.oneOf.length === 0) return zodSchema;

        // Convert each oneOf schema
        const oneOfSchemas = schema.oneOf.map(s => convertJsonSchemaToZod(s));

        // Apply oneOf validation as a refinement on top of the base schema
        // This preserves other constraints like allOf, anyOf, etc.
        return zodSchema.refine(
            (value: any) => {
                let validCount = 0;
                
                // Check how many oneOf schemas validate this value
                for (const oneOfSchema of oneOfSchemas) {
                    const result = oneOfSchema.safeParse(value);
                    if (result.success) {
                        validCount++;
                        // Early exit optimization - if more than one matches, we know it will fail
                        if (validCount > 1) return false;
                    }
                }
                
                // oneOf requires exactly one schema to match
                return validCount === 1;
            },
            { message: "Value must match exactly one of the oneOf schemas" }
        );
    }
}