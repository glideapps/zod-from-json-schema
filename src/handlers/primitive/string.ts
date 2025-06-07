import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { PrimitiveHandler, TypeSchemas } from "../../core/types";

export class MinLengthHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const stringSchema = schema as JSONSchema.StringSchema;
        if (stringSchema.minLength === undefined) return;

        if (types.string !== false) {
            types.string = (types.string || z.string()).min(stringSchema.minLength);
        }
    }
}

export class MaxLengthHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const stringSchema = schema as JSONSchema.StringSchema;
        if (stringSchema.maxLength === undefined) return;

        if (types.string !== false) {
            types.string = (types.string || z.string()).max(stringSchema.maxLength);
        }
    }
}

export class PatternHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const stringSchema = schema as JSONSchema.StringSchema;
        if (!stringSchema.pattern) return;

        if (types.string !== false) {
            const regex = new RegExp(stringSchema.pattern);
            types.string = (types.string || z.string()).regex(regex);
        }
    }
}