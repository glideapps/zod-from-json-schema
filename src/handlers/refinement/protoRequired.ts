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
        
        // Only handle schemas with __proto__ in required and no explicit type
        if (!objectSchema.required?.includes("__proto__") || schema.type !== undefined) {
            return zodSchema;
        }
        
        // Use z.any() to preserve __proto__ property
        return z.any().refine(
            (value: any) => this.validateRequired(value, objectSchema.required!),
            { message: "Missing required properties" }
        );
    }

    private validateRequired(value: any, required: string[]): boolean {
        // Non-objects pass through
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
            return true;
        }
        
        // Check all required properties exist
        return required.every(prop => 
            Object.prototype.hasOwnProperty.call(value, prop)
        );
    }
}