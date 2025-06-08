import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";

/**
 * Special handler to ensure null in enums is represented as {const: null}
 * This runs after the main enum handler to fix the representation
 */
export class EnumNullHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        // Only apply to schemas with enum containing null
        if (!schema.enum || !schema.enum.includes(null)) {
            return zodSchema;
        }

        // If this is a union that includes z.null(), we need to replace it with z.literal(null)
        if (zodSchema instanceof z.ZodUnion) {
            const options = (zodSchema as any).def.options as z.ZodTypeAny[];
            const newOptions = options.map((opt) => {
                if (opt instanceof z.ZodNull) {
                    return z.literal(null);
                }
                return opt;
            });

            if (newOptions.length === 2) {
                return z.union([newOptions[0], newOptions[1]]);
            } else {
                return z.union([newOptions[0], newOptions[1], ...newOptions.slice(2)]);
            }
        }

        return zodSchema;
    }
}
