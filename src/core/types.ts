import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";

export interface TypeSchemas {
    string?: z.ZodTypeAny | false;
    number?: z.ZodTypeAny | false;
    boolean?: z.ZodTypeAny | false;
    null?: z.ZodNull | false;
    array?: z.ZodArray<any> | false;
    tuple?: z.ZodTuple | false;
    object?: z.ZodObject<any> | false;
    file?: z.ZodFile | false;
}

/**
 * Options for converting a JSON Schema to a Zod schema.
 */
export interface ConversionOptions {
    /**
     * Called for every (non-boolean) JSON Schema node that produces a Zod
     * type. If it returns a non-empty object, that object is attached to the
     * resulting Zod type via `.meta()`, merging with the schema's
     * `description` (a `description` key in the returned object wins).
     *
     * The callback must be pure: a node may be converted more than once, and
     * some resulting Zod types are only used internally for validation.
     */
    metaForSchema?: (schema: JSONSchema.BaseSchema) => Record<string, unknown> | undefined;
}

export interface PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema, options: ConversionOptions): void;
}

export interface RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema, options: ConversionOptions): z.ZodTypeAny;
}
