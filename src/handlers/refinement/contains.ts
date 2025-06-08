import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";
import { isValidWithSchema } from "../../core/utils";

export class ContainsHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        const arraySchema = schema as JSONSchema.ArraySchema;
        
        if (arraySchema.contains === undefined) return zodSchema;

        const containsSchema = convertJsonSchemaToZod(arraySchema.contains);
        const minContains = arraySchema.minContains ?? 1;
        const maxContains = arraySchema.maxContains;

        return zodSchema.refine(
            (value: any) => {
                if (!Array.isArray(value)) {
                    return true;
                }

                let matchCount = 0;
                for (const item of value) {
                    if (isValidWithSchema(containsSchema, item)) {
                        matchCount++;
                    }
                }

                if (matchCount < minContains) {
                    return false;
                }

                if (maxContains !== undefined && matchCount > maxContains) {
                    return false;
                }

                return true;
            },
            { message: "Array must contain required items matching the schema" }
        );
    }
}