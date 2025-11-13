import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { PrimitiveHandler, TypeSchemas } from "../../core/types";

/**
 * Detects file schemas based on JSON Schema format
 * File schemas have: type: "string", format: "binary", contentEncoding: "binary"
 */
export class FileHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const stringSchema = schema as JSONSchema.StringSchema;

        // Detect file schema: type: "string", format: "binary", contentEncoding: "binary"
        if (
            stringSchema.type === "string" &&
            stringSchema.format === "binary" &&
            stringSchema.contentEncoding === "binary"
        ) {
            // Start with base file schema
            let fileSchema: z.ZodFile = z.file();

            // Apply size constraints (minLength -> min, maxLength -> max)
            if (stringSchema.minLength !== undefined) {
                fileSchema = fileSchema.min(stringSchema.minLength);
            }

            if (stringSchema.maxLength !== undefined) {
                fileSchema = fileSchema.max(stringSchema.maxLength);
            }

            // Apply MIME type constraint (contentMediaType -> mime)
            if (stringSchema.contentMediaType !== undefined) {
                fileSchema = fileSchema.mime(stringSchema.contentMediaType);
            }

            // Set the file type and disable string type
            types.file = fileSchema;
            types.string = false;
        }
    }
}
