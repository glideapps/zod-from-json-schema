import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { PrimitiveHandler, TypeSchemas } from "../../core/types";

export class ConstHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        if (schema.const === undefined) return;

        const constValue = schema.const;

        // Set all types to false
        types.string = false;
        types.number = false;
        types.boolean = false;
        types.null = false;
        types.array = false;
        types.object = false;

        // Enable only the type that matches const
        if (typeof constValue === "string") {
            types.string = z.literal(constValue);
        } else if (typeof constValue === "number") {
            types.number = z.literal(constValue);
        } else if (typeof constValue === "boolean") {
            types.boolean = z.literal(constValue);
        } else if (constValue === null) {
            types.null = z.null();
        } else if (Array.isArray(constValue)) {
            // Complex const values are handled by refinement
            types.array = undefined;
        } else if (typeof constValue === "object") {
            // Complex const values are handled by refinement
            types.object = undefined;
        }
    }
}