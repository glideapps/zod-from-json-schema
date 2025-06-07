import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";

export interface TypeSchemas {
    string?: z.ZodString | false;
    number?: z.ZodNumber | false;
    boolean?: z.ZodBoolean | false;
    null?: z.ZodNull | false;
    array?: z.ZodArray<any> | false;
    object?: z.ZodObject<any> | false;
}

export interface PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void;
}

export interface RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny;
}