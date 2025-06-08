import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { PrimitiveHandler, TypeSchemas } from "../../core/types";

export class ImplicitStringHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const stringSchema = schema as JSONSchema.StringSchema;
        
        // If no explicit type but string constraints are present, enable string type
        if (schema.type === undefined && 
            (stringSchema.minLength !== undefined || stringSchema.maxLength !== undefined || stringSchema.pattern !== undefined)) {
            if (types.string === undefined) {
                types.string = z.string();
            }
        }
    }
}

export class MinLengthHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const stringSchema = schema as JSONSchema.StringSchema;
        if (stringSchema.minLength === undefined) return;

        // Enable string type if minLength is present (even without explicit type)
        if (types.string !== false) {
            const currentString = types.string || z.string();
            if (currentString instanceof z.ZodString) {
                types.string = currentString.min(stringSchema.minLength);
            }
        }
    }
}

export class MaxLengthHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const stringSchema = schema as JSONSchema.StringSchema;
        if (stringSchema.maxLength === undefined) return;

        if (types.string !== false) {
            const currentString = types.string || z.string();
            if (currentString instanceof z.ZodString) {
                types.string = currentString.max(stringSchema.maxLength);
            }
        }
    }
}

export class PatternHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const stringSchema = schema as JSONSchema.StringSchema;
        if (!stringSchema.pattern) return;

        if (types.string !== false) {
            const currentString = types.string || z.string();
            if (currentString instanceof z.ZodString) {
                const regex = new RegExp(stringSchema.pattern);
                types.string = currentString.regex(regex);
            }
        }
    }
}