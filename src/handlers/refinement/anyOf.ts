import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";
import { NON_CONSTRAINT_KEYS } from "../../core/refs";

// Reference keywords are in NON_CONSTRAINT_KEYS (they don't constrain the
// base types), but RefHandler enforces them as refinements on the base
// schema, so a base carrying them cannot be discarded.
const REF_KEYWORDS = new Set(["$ref", "$dynamicRef"]);

/**
 * Checks whether the base schema passed to AnyOfHandler carries no
 * constraints of its own, i.e. the schema's only constraint is anyOf.
 */
function baseIsUnconstrained(schema: JSONSchema.BaseSchema): boolean {
    return Object.keys(schema).every(
        (key) => key === "anyOf" || (NON_CONSTRAINT_KEYS.has(key) && !REF_KEYWORDS.has(key)),
    );
}

export class AnyOfHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        if (!schema.anyOf || schema.anyOf.length === 0) return zodSchema;

        const anyOfSchema =
            schema.anyOf.length === 1
                ? convertJsonSchemaToZod(schema.anyOf[0])
                : z.union([
                      convertJsonSchemaToZod(schema.anyOf[0]),
                      convertJsonSchemaToZod(schema.anyOf[1]),
                      ...schema.anyOf.slice(2).map(s => convertJsonSchemaToZod(s))
                  ]);

        // When anyOf is the schema's only constraint, the base schema adds
        // nothing; return the plain union so the result stays representable
        // in z.toJSONSchema (#63).
        if (baseIsUnconstrained(schema)) return anyOfSchema;

        // Intersect with base schema to preserve existing constraints
        return z.intersection(zodSchema, anyOfSchema);
    }
}
