import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { PrimitiveHandler, TypeSchemas } from "../../core/types";
import deepEqual from "deep-equal";

export class EnumHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        if (!schema.enum) return;

        // Empty enum means nothing is allowed
        if (schema.enum.length === 0) {
            // Don't set all types to false if there's an explicit type constraint
            // The type handler will handle that
            return;
        }

        // Analyze enum values to determine which types to allow
        const hasString = schema.enum.some(v => typeof v === "string");
        const hasNumber = schema.enum.some(v => typeof v === "number");
        const hasBoolean = schema.enum.some(v => typeof v === "boolean");
        const hasNull = schema.enum.some(v => v === null);
        const hasArray = schema.enum.some(v => Array.isArray(v));
        const hasObject = schema.enum.some(v => typeof v === "object" && v !== null && !Array.isArray(v));

        // Check if all enum values are primitive (for optimization)
        const allPrimitive = schema.enum.every(
            val => typeof val === "string" || typeof val === "number" || 
                   typeof val === "boolean" || val === null
        );

        if (allPrimitive) {
            // For all-primitive enums, we can use z.literal unions
            const allStrings = schema.enum.every(val => typeof val === "string");
            
            if (allStrings) {
                // Special case: all strings can use z.enum
                types.string = z.enum(schema.enum as [string, ...string[]]);
                types.number = false;
                types.boolean = false;
                types.null = false;
                types.array = false;
                types.object = false;
            } else {
                // Mixed primitives - create literal schemas for each type
                if (hasString && types.string !== false) {
                    const stringValues = schema.enum.filter(v => typeof v === "string");
                    if (stringValues.length === 1) {
                        types.string = z.literal(stringValues[0]);
                    } else {
                        types.string = z.enum(stringValues as [string, ...string[]]);
                    }
                } else {
                    types.string = false;
                }

                if (hasNumber && types.number !== false) {
                    const numberValues = schema.enum.filter(v => typeof v === "number");
                    if (numberValues.length === 1) {
                        types.number = z.literal(numberValues[0]);
                    } else {
                        const [first, second, ...rest] = numberValues;
                        types.number = z.union([z.literal(first), z.literal(second), ...rest.map(v => z.literal(v))]);
                    }
                } else {
                    types.number = false;
                }

                if (hasBoolean && types.boolean !== false) {
                    const booleanValues = schema.enum.filter(v => typeof v === "boolean");
                    if (booleanValues.length === 1) {
                        types.boolean = z.literal(booleanValues[0]);
                    } else {
                        // Create union of boolean literals
                        types.boolean = z.union([z.literal(true), z.literal(false)]);
                    }
                } else {
                    types.boolean = false;
                }

                if (hasNull && types.null !== false) {
                    types.null = z.null();
                } else {
                    types.null = false;
                }

                types.array = false;
                types.object = false;
            }
        } else {
            // Complex values - use refinement for non-primitives
            if (!hasString) types.string = false;
            if (!hasNumber) types.number = false;
            if (!hasBoolean) types.boolean = false;
            if (!hasNull) types.null = false;

            if (hasArray && types.array !== false) {
                const arrayValues = schema.enum.filter(v => Array.isArray(v));
                types.array = z.array(z.any()).refine(
                    (value: any[]) => arrayValues.some(enumValue => deepEqual(value, enumValue, { strict: true })),
                    { message: "Value must be one of the enum values" }
                );
            } else {
                types.array = false;
            }

            if (hasObject && types.object !== false) {
                const objectValues = schema.enum.filter(v => typeof v === "object" && v !== null && !Array.isArray(v));
                types.object = z.object({}).passthrough().refine(
                    (value: object) => objectValues.some(enumValue => deepEqual(value, enumValue, { strict: true })),
                    { message: "Value must be one of the enum values" }
                );
            } else {
                types.object = false;
            }

            // Handle primitive values within the enum
            if (hasString && types.string !== false) {
                const stringValues = schema.enum.filter(v => typeof v === "string");
                if (stringValues.length === 1) {
                    types.string = z.literal(stringValues[0]);
                } else {
                    types.string = z.enum(stringValues as [string, ...string[]]);
                }
            }

            if (hasNumber && types.number !== false) {
                const numberValues = schema.enum.filter(v => typeof v === "number");
                if (numberValues.length === 1) {
                    types.number = z.literal(numberValues[0]);
                } else {
                    const [first, second, ...rest] = numberValues;
                    types.number = z.union([z.literal(first), z.literal(second), ...rest.map(v => z.literal(v))]);
                }
            }

            if (hasBoolean && types.boolean !== false) {
                const booleanValues = schema.enum.filter(v => typeof v === "boolean");
                if (booleanValues.length === 1) {
                    types.boolean = z.literal(booleanValues[0]);
                } else {
                    // Create union of boolean literals
                    types.boolean = z.union([z.literal(true), z.literal(false)]);
                }
            }

            if (hasNull && types.null !== false) {
                types.null = z.null();
            }
        }
    }
}