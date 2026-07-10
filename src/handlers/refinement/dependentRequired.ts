import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";

/**
 * Handles the `dependentRequired` keyword from JSON Schema draft 2020-12.
 *
 * For every property name listed in `dependentRequired` that is present in
 * the validated object, all of its dependent property names must also be
 * present. Non-object values are not affected by this keyword.
 */
export class DependentRequiredHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        const dependentRequired = schema.dependentRequired;

        if (dependentRequired === undefined) return zodSchema;

        const entries = Object.entries(dependentRequired);

        return zodSchema.refine(
            (value: unknown) => {
                if (typeof value !== "object" || value === null || Array.isArray(value)) {
                    return true;
                }

                return entries.every(
                    ([property, dependents]) =>
                        !Object.prototype.hasOwnProperty.call(value, property) ||
                        dependents.every((dependent) =>
                            Object.prototype.hasOwnProperty.call(value, dependent),
                        ),
                );
            },
            { message: "Missing dependent required properties" },
        );
    }
}
