import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { PrimitiveHandler, TypeSchemas } from "../../core/types";
import deepEqual from "deep-equal";

export class ConstHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        if (schema.const === undefined) return;

        // const overrides everything - set all types to false except the matching one
        const constValue = schema.const;

        if (typeof constValue === "string") {
            types.string = z.literal(constValue);
            types.number = false;
            types.boolean = false;
            types.null = false;
            types.array = false;
            types.object = false;
        } else if (typeof constValue === "number") {
            types.string = false;
            types.number = z.literal(constValue);
            types.boolean = false;
            types.null = false;
            types.array = false;
            types.object = false;
        } else if (typeof constValue === "boolean") {
            types.string = false;
            types.number = false;
            types.boolean = z.literal(constValue);
            types.null = false;
            types.array = false;
            types.object = false;
        } else if (constValue === null) {
            types.string = false;
            types.number = false;
            types.boolean = false;
            types.null = z.null();
            types.array = false;
            types.object = false;
        } else if (Array.isArray(constValue)) {
            types.string = false;
            types.number = false;
            types.boolean = false;
            types.null = false;
            types.array = z.array(z.any()).refine(
                (value: any[]) => deepEqual(value, constValue, { strict: true }),
                { message: "Value must equal the const value" }
            );
            types.object = false;
        } else if (typeof constValue === "object") {
            types.string = false;
            types.number = false;
            types.boolean = false;
            types.null = false;
            types.array = false;
            types.object = z.object({}).passthrough().refine(
                (value: object) => deepEqual(value, constValue, { strict: true }),
                { message: "Value must equal the const value" }
            );
        }
    }
}