import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";

export interface TypeSchemas {
    string?: z.ZodTypeAny | false;
    number?: z.ZodTypeAny | false;
    boolean?: z.ZodTypeAny | false;
    null?: z.ZodNull | false;
    array?: z.ZodArray<any> | false;
    tuple?: z.ZodTuple | false;
    // Object schemas may be wrapped (preprocess/pipe), so allow any Zod type to preserve wrappers applied during conversion.
    object?: z.ZodTypeAny | false;
}

export interface PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void;
}

export interface RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny;
}
