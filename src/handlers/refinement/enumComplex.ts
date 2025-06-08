import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { deepEqual } from "../../core/utils";

export class EnumComplexHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        if (!schema.enum || schema.enum.length === 0) return zodSchema;

        // Get complex enum values (arrays and objects)
        const complexValues = schema.enum.filter(v => 
            Array.isArray(v) || (typeof v === "object" && v !== null)
        );

        if (complexValues.length === 0) return zodSchema;

        // Add refinement to check for complex enum values
        return zodSchema.refine(
            (value: any) => {
                // If it's a primitive type, it's already handled
                if (typeof value !== "object" || value === null) return true;
                
                // Check if the value matches any of the complex enum values
                return complexValues.some(enumValue => 
                    deepEqual(value, enumValue)
                );
            },
            { message: "Value must match one of the enum values" }
        );
    }
}