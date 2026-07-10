import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";
import { isValidWithSchema } from "../../core/utils";

/**
 * Handles the JSON Schema `if`/`then`/`else` conditional keywords.
 *
 * Per JSON Schema draft 2020-12: when the instance validates against the
 * `if` subschema, it must also validate against `then` (when present);
 * otherwise it must validate against `else` (when present). A lone `if`
 * (without `then` and `else`), or `then`/`else` without `if`, imposes no
 * constraints. Boolean subschemas (`if: false`, etc.) are honored.
 */
export class IfThenElseHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        if (schema.if === undefined) return zodSchema;
        if (schema.then === undefined && schema.else === undefined) {
            return zodSchema;
        }

        const ifZod = convertJsonSchemaToZod(schema.if);
        const thenZod = schema.then !== undefined ? convertJsonSchemaToZod(schema.then) : z.any();
        const elseZod = schema.else !== undefined ? convertJsonSchemaToZod(schema.else) : z.any();

        return zodSchema.refine(
            (value: any) =>
                isValidWithSchema(ifZod, value)
                    ? isValidWithSchema(thenZod, value)
                    : isValidWithSchema(elseZod, value),
            { message: "Value must match the 'then'/'else' schema selected by 'if'" },
        );
    }
}
