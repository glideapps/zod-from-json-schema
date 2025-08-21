import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { PrimitiveHandler, TypeSchemas } from "../../core/types";

export class MinimumHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const numberSchema = schema as JSONSchema.NumberSchema;
        if (numberSchema.minimum === undefined) return;

        if (types.number !== false) {
            const currentNumber = types.number || z.number();
            if (currentNumber instanceof z.ZodNumber) {
                types.number = currentNumber.min(numberSchema.minimum);
            }
        }
    }
}

export class MaximumHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const numberSchema = schema as JSONSchema.NumberSchema;
        if (numberSchema.maximum === undefined) return;

        if (types.number !== false) {
            const currentNumber = types.number || z.number();
            if (currentNumber instanceof z.ZodNumber) {
                types.number = currentNumber.max(numberSchema.maximum);
            }
        }
    }
}

export class ExclusiveMinimumHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const numberSchema = schema as JSONSchema.NumberSchema;
        if (numberSchema.exclusiveMinimum === undefined) return;

        if (types.number !== false) {
            const currentNumber = types.number || z.number();
            if (currentNumber instanceof z.ZodNumber) {
                if (typeof numberSchema.exclusiveMinimum === "number") {
                    types.number = currentNumber.gt(numberSchema.exclusiveMinimum);
                } else {
                    types.number = false;
                }
            }
        }
    }
}

export class ExclusiveMaximumHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const numberSchema = schema as JSONSchema.NumberSchema;
        if (numberSchema.exclusiveMaximum === undefined) return;

        if (types.number !== false) {
            const currentNumber = types.number || z.number();
            if (currentNumber instanceof z.ZodNumber) {
                if (typeof numberSchema.exclusiveMaximum === "number") {
                    types.number = currentNumber.lt(numberSchema.exclusiveMaximum);
                } else {
                    types.number = false;
                }
            }
        }
    }
}

export class MultipleOfHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const numberSchema = schema as JSONSchema.NumberSchema;
        if (numberSchema.multipleOf === undefined) return;

        if (types.number !== false) {
            const currentNumber = types.number || z.number();
            if (currentNumber instanceof z.ZodNumber) {
                // Use custom validation for better floating-point precision handling
                types.number = currentNumber.refine(
                    (value: number) => {
                        if (numberSchema.multipleOf === 0) return false;
                        
                        // Handle very small divisors with precision tolerance
                        const quotient = value / numberSchema.multipleOf!;
                        const rounded = Math.round(quotient);
                        
                        // Check if the quotient is close enough to an integer
                        // Use a tolerance based on the smaller of the two numbers
                        const tolerance = Math.min(
                            Math.abs(value) * Number.EPSILON * 10,
                            Math.abs(numberSchema.multipleOf!) * Number.EPSILON * 10
                        );
                        
                        return Math.abs(quotient - rounded) <= tolerance / Math.abs(numberSchema.multipleOf!);
                    },
                    { message: `Must be a multiple of ${numberSchema.multipleOf}` }
                );
            }
        }
    }
}