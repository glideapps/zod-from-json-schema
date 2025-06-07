import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { PrimitiveHandler, TypeSchemas } from "../../core/types";

export class MinimumHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const numberSchema = schema as JSONSchema.NumberSchema;
        if (numberSchema.minimum === undefined) return;

        if (types.number !== false) {
            types.number = (types.number || z.number()).min(numberSchema.minimum);
        }
    }
}

export class MaximumHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const numberSchema = schema as JSONSchema.NumberSchema;
        if (numberSchema.maximum === undefined) return;

        if (types.number !== false) {
            types.number = (types.number || z.number()).max(numberSchema.maximum);
        }
    }
}

export class ExclusiveMinimumHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const numberSchema = schema as JSONSchema.NumberSchema;
        if (numberSchema.exclusiveMinimum === undefined) return;

        if (types.number !== false) {
            types.number = (types.number || z.number()).gt(numberSchema.exclusiveMinimum);
        }
    }
}

export class ExclusiveMaximumHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const numberSchema = schema as JSONSchema.NumberSchema;
        if (numberSchema.exclusiveMaximum === undefined) return;

        if (types.number !== false) {
            types.number = (types.number || z.number()).lt(numberSchema.exclusiveMaximum);
        }
    }
}

export class MultipleOfHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const numberSchema = schema as JSONSchema.NumberSchema;
        if (numberSchema.multipleOf === undefined) return;

        if (types.number !== false) {
            types.number = (types.number || z.number()).multipleOf(numberSchema.multipleOf);
        }
    }
}