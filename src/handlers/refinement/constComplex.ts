import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { deepEqual, schemaConstrainsProtoProperty } from "../../core/utils";

/**
 * Returns the schema's `const` value if it is complex (an array or object),
 * and undefined otherwise. Primitive const values are handled by the
 * primitive ConstHandler.
 */
export function getComplexConstValue(schema: JSONSchema.BaseSchema): unknown {
    const constValue = schema.const;

    if (constValue === undefined || typeof constValue !== "object" || constValue === null) {
        return undefined;
    }

    return constValue;
}

export class ConstComplexHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        // Schemas constraining "__proto__" are checked on the raw input by
        // ProtoPropertyHandler; this refinement would only ever see Zod's
        // __proto__-stripped parse output.
        if (schemaConstrainsProtoProperty(schema)) return zodSchema;

        const constValue = getComplexConstValue(schema);
        if (constValue === undefined) return zodSchema;

        // Add refinement to check for exact match
        return zodSchema.refine(
            (value: unknown) => deepEqual(value, constValue),
            { message: "Value must equal the const value" }
        );
    }
}
