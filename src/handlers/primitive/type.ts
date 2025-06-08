import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { PrimitiveHandler, TypeSchemas } from "../../core/types";

export class TypeHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        if (!schema.type) return;

        const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
        const typeSet = new Set(allowedTypes);

        // Set disallowed types to false
        if (!typeSet.has("string")) {
            types.string = false;
        }
        if (!typeSet.has("number") && !typeSet.has("integer")) {
            types.number = false;
        }
        if (!typeSet.has("boolean")) {
            types.boolean = false;
        }
        if (!typeSet.has("null")) {
            types.null = false;
        }
        if (!typeSet.has("array")) {
            types.array = false;
        }
        if (!typeSet.has("object")) {
            types.object = false;
        }

        // For integer type, ensure number schema with int constraint
        if (typeSet.has("integer") && types.number !== false) {
            const currentNumber = types.number || z.number();
            if (currentNumber instanceof z.ZodNumber) {
                types.number = currentNumber.int();
            }
        }
    }
}