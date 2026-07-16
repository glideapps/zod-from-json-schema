import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";
import { isValidWithSchema, mentionsProtoKey } from "../../core/utils";

/**
 * Handles the `dependentSchemas` keyword (JSON Schema draft 2020-12).
 *
 * For each entry in `dependentSchemas`, if the instance is a non-array
 * object that has the entry's key as an own property, the whole instance
 * must additionally validate against the entry's subschema. Non-object
 * instances always pass.
 */
export class DependentSchemasHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        const dependentSchemas = (schema as any).dependentSchemas;
        if (typeof dependentSchemas !== "object" || dependentSchemas === null) {
            return zodSchema;
        }

        // Convert each dependent subschema once, up front.
        const dependencies: [string, z.ZodTypeAny][] = Object.entries(
            dependentSchemas,
        )
            .filter(([, subSchema]) => subSchema !== undefined)
            .map(([key, subSchema]) => [
                key,
                convertJsonSchemaToZod(
                    subSchema as JSONSchema.BaseSchema | boolean,
                ),
            ]);

        if (dependencies.length === 0) {
            return zodSchema;
        }

        const check = (value: any): boolean => {
            // dependentSchemas only applies to non-array objects
            if (
                typeof value !== "object" ||
                value === null ||
                Array.isArray(value)
            ) {
                return true;
            }

            return dependencies.every(
                ([key, dependentSchema]) =>
                    !Object.prototype.hasOwnProperty.call(value, key) ||
                    isValidWithSchema(dependentSchema, value),
            );
        };
        const message = "Value does not satisfy a dependent schema";

        // When "__proto__" is involved, the check must see the raw input:
        // the base schema's parse output has own "__proto__" keys stripped.
        // Only then; piping hides the base's structure from z.toJSONSchema's
        // "input" io, which the plain refinement preserves.
        if (mentionsProtoKey(dependentSchemas)) {
            return z.any().refine(check, { message }).pipe(zodSchema);
        }

        return zodSchema.refine(check, { message });
    }
}
