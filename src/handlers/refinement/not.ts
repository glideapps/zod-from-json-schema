import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";
import { isValidWithSchema } from "../../core/utils";

export class NotHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        if (!(schema as any).not) return zodSchema;

        const notSchema = convertJsonSchemaToZod((schema as any).not);
        return zodSchema.refine(
            (value: any) => !isValidWithSchema(notSchema, value),
            { message: "Value must not match the 'not' schema" }
        );
    }
}