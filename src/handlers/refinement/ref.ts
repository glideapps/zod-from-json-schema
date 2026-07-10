import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { convertSchemaRefs } from "../../core/refs";

/**
 * Applies $ref and $dynamicRef ($dynamicRef is resolved statically, like
 * $ref). Each resolvable reference target is enforced conjunctively with the
 * rest of the schema via a refinement (a z.intersection would try to merge
 * the parse outputs of both sides and throws when they differ, e.g. when the
 * referenced schema applies a default). Unresolvable references leave the
 * schema unchanged (permissive).
 */
export class RefHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        let result = zodSchema;
        for (const targetSchema of convertSchemaRefs(schema)) {
            result = result.refine((value) => targetSchema.safeParse(value).success, {
                message: "Value does not match referenced schema",
            });
        }
        return result;
    }
}
