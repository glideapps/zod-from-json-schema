import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { convertSchemaRefs } from "../../core/refs";

/**
 * Applies $ref and $dynamicRef ($dynamicRef is resolved statically, like
 * $ref).
 *
 * A "bare" reference — a node whose only resolvable reference stands alone,
 * with no sibling constraint keywords (the converter then passes in the
 * permissive z.any() base) — returns the target's completed conversion
 * directly, so callers see the target's structural Zod type (z.string(),
 * z.object(...), ...) instead of an opaque refinement on z.any(). Sharing
 * the memoized target instance is safe: Zod schemas are immutable, and
 * later handlers (e.g. MetadataHandler's .describe) operate on clones. A
 * reference dropped as unresolvable imposes no constraint, so a node whose
 * other reference keyword failed to resolve still counts as bare.
 *
 * In every other case — sibling constraints, multiple resolvable
 * references, or a still-in-flight (recursive) target — each resolvable
 * target is enforced conjunctively with the rest of the schema via a
 * refinement (a z.intersection would try to merge the parse outputs of both
 * sides and throws when they differ, e.g. when the referenced schema
 * applies a default). Unresolvable references leave the schema unchanged
 * (permissive).
 */
export class RefHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        const refs = convertSchemaRefs(schema);
        // The converter only produces a z.any() base for schemas without
        // constraint keywords, so instanceof identifies bare references.
        if (refs.length === 1 && !refs[0].deferred && zodSchema instanceof z.ZodAny) {
            return refs[0].schema;
        }
        let result = zodSchema;
        for (const { schema: targetSchema } of refs) {
            result = result.refine((value) => targetSchema.safeParse(value).success, {
                message: "Value does not match referenced schema",
            });
        }
        return result;
    }
}
