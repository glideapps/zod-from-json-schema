import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";

/**
 * Special handler for when __proto__ is in required properties.
 * This is needed because z.object().passthrough() strips __proto__ for security.
 */
export class ProtoRequiredHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        const objectSchema = schema as JSONSchema.ObjectSchema;
        
        // Only handle if __proto__ is in required
        if (!objectSchema.required?.includes("__proto__")) {
            return zodSchema;
        }
        
        // Only apply to schemas without explicit type (will be unions)
        if (schema.type !== undefined) {
            return zodSchema;
        }
        
        // Replace the schema with z.any() plus validation
        return z.any().refine(
            (value: any) => {
                // Non-objects should pass (unless type is explicitly object)
                if (typeof value !== "object" || value === null || Array.isArray(value)) {
                    return true;
                }
                
                // Check all required properties including __proto__
                for (const requiredProp of objectSchema.required) {
                    if (!Object.prototype.hasOwnProperty.call(value, requiredProp)) {
                        return false;
                    }
                }
                
                return true;
            },
            { message: "Missing required properties" }
        );
    }
}