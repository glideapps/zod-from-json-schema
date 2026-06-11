import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { ConversionOptions, RefinementHandler } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";

export class AllOfHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema, options: ConversionOptions): z.ZodTypeAny {
        if (!schema.allOf || schema.allOf.length === 0) return zodSchema;

        // Convert all schemas in allOf
        const allOfSchemas = schema.allOf.map(s => convertJsonSchemaToZod(s, options));

        // Intersect all schemas together, including the base schema
        return allOfSchemas.reduce(
            (acc: z.ZodTypeAny, s: z.ZodTypeAny) => z.intersection(acc, s),
            zodSchema
        );
    }
}