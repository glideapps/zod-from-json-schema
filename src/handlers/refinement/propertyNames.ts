import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";

/**
 * Handles the `propertyNames` keyword (JSON Schema draft 2020-12).
 *
 * Every property name of an object instance must validate against the
 * `propertyNames` subschema. Since property names are always strings,
 * the subschema effectively constrains keys with string keywords such
 * as `pattern`, `maxLength`, `const`, or `enum`. Boolean subschemas
 * follow the usual semantics: `true` accepts every key and `false`
 * rejects objects with any properties. Non-object instances are
 * ignored, per the specification.
 */
export class PropertyNamesHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        const objectSchema = schema as JSONSchema.ObjectSchema;

        if (objectSchema.propertyNames === undefined) {
            return zodSchema;
        }

        // Convert once, outside the refinement, so parsing stays cheap.
        const nameSchema = convertJsonSchemaToZod(objectSchema.propertyNames);

        return zodSchema.refine(
            (value: unknown) => {
                // propertyNames only constrains objects
                if (typeof value !== "object" || value === null || Array.isArray(value)) {
                    return true;
                }

                for (const key of Object.keys(value)) {
                    if (!nameSchema.safeParse(key).success) {
                        return false;
                    }
                }

                return true;
            },
            { message: "Property names validation failed" }
        );
    }
}
