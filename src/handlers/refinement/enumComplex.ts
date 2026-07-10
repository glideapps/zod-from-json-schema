import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { deepEqual, schemaConstrainsProtoProperty } from "../../core/utils";

/**
 * Extracts the complex (array and object) values from a schema's `enum`.
 */
export function getComplexEnumValues(schema: JSONSchema.BaseSchema): unknown[] {
    if (!schema.enum || schema.enum.length === 0) return [];

    return schema.enum.filter(
        (v) => Array.isArray(v) || (typeof v === "object" && v !== null),
    );
}

/**
 * Checks a value against the complex members of an `enum`. Primitive values
 * are handled by the primitive EnumHandler, so they pass here.
 */
export function matchesComplexEnumValue(value: unknown, complexValues: unknown[]): boolean {
    // If it's a primitive type, it's already handled
    if (typeof value !== "object" || value === null) return true;

    // Check if the value matches any of the complex enum values
    return complexValues.some((enumValue) => deepEqual(value, enumValue));
}

export class EnumComplexHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        // Schemas constraining "__proto__" are checked on the raw input by
        // ProtoPropertyHandler; this refinement would only ever see Zod's
        // __proto__-stripped parse output.
        if (schemaConstrainsProtoProperty(schema)) return zodSchema;

        const complexValues = getComplexEnumValues(schema);
        if (complexValues.length === 0) return zodSchema;

        // Add refinement to check for complex enum values
        return zodSchema.refine(
            (value: unknown) => matchesComplexEnumValue(value, complexValues),
            { message: "Value must match one of the enum values" }
        );
    }
}
