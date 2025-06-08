import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";

/**
 * Applies string constraints conditionally when no explicit type is specified
 */
export class StringConstraintsHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        // Only apply if there's no explicit type
        if (schema.type !== undefined) return zodSchema;
        
        const s = schema as JSONSchema.StringSchema;
        
        // Check if there are string-specific constraints
        if (s.minLength === undefined && s.maxLength === undefined && s.pattern === undefined) {
            return zodSchema;
        }
        
        // Apply conditional validation - only validate strings
        return zodSchema.refine(
            (value: any) => {
                // Non-strings are always valid
                if (typeof value !== "string") return true;
                
                // Apply string constraints
                if (s.minLength !== undefined && value.length < s.minLength) {
                    return false;
                }
                
                if (s.maxLength !== undefined && value.length > s.maxLength) {
                    return false;
                }
                
                if (s.pattern !== undefined) {
                    const regex = new RegExp(s.pattern);
                    if (!regex.test(value)) {
                        return false;
                    }
                }
                
                return true;
            },
            { message: "String constraints validation failed" }
        );
    }
}