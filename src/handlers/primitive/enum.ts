import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { PrimitiveHandler, TypeSchemas } from "../../core/types";

export class EnumHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        if (!schema.enum) return;

        // Handle empty enum special case
        if (schema.enum.length === 0) {
            if (!schema.type) {
                // Empty enum without type rejects everything
                types.string = false;
                types.number = false;
                types.boolean = false;
                types.null = false;
                types.array = false;
                types.object = false;
            }
            // Empty enum with type allows that type (enum:[] is interpreted as no enum constraint)
            return;
        }

        // Group enum values by type
        const valuesByType = {
            string: schema.enum.filter((v) => typeof v === "string"),
            number: schema.enum.filter((v) => typeof v === "number"),
            boolean: schema.enum.filter((v) => typeof v === "boolean"),
            null: schema.enum.filter((v) => v === null),
            array: schema.enum.filter((v) => Array.isArray(v)),
            object: schema.enum.filter((v) => typeof v === "object" && v !== null && !Array.isArray(v)),
        };

        // Set each type based on whether it has values in the enum
        types.string = this.createTypeSchema(valuesByType.string, "string");
        types.number = this.createTypeSchema(valuesByType.number, "number");
        types.boolean = this.createTypeSchema(valuesByType.boolean, "boolean");
        types.null = valuesByType.null.length > 0 ? z.null() : false;

        // Arrays and objects are handled by refinement handlers
        types.array = valuesByType.array.length > 0 ? undefined : false;
        types.object = valuesByType.object.length > 0 ? undefined : false;
    }

    private createTypeSchema(values: any[], type: "string" | "number" | "boolean"): z.ZodTypeAny | false {
        if (values.length === 0) return false;

        if (values.length === 1) {
            return z.literal(values[0]);
        }

        if (type === "string") {
            return z.enum(values as [string, ...string[]]);
        }

        if (type === "number") {
            const [first, second, ...rest] = values;
            return z.union([z.literal(first), z.literal(second), ...rest.map((v) => z.literal(v))]);
        }

        if (type === "boolean") {
            return z.union([z.literal(true), z.literal(false)]);
        }

        return false;
    }
}
