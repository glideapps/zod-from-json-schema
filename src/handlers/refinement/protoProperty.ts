import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";
import { deepEqual, schemaConstrainsProtoProperty } from "../../core/utils";
import { getComplexEnumValues, matchesComplexEnumValue } from "./enumComplex";
import { getComplexConstValue } from "./constComplex";

/**
 * Checks whether object keywords apply to a value: JSON Schema object
 * keywords only constrain objects (and not arrays).
 */
function isConstrainableObject(value: unknown): value is object {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates "__proto__" entries in `properties` and `required` against the
 * RAW input, before Zod's object parsing runs.
 *
 * This must happen outside the converted schema because Zod strips own
 * "__proto__" keys from its parse output as a prototype-pollution defense,
 * so any refinement running on that output can never see the key. z.any()
 * passes the input through untouched, so a refine on it observes the own
 * "__proto__" key; `.pipe()` then runs the full converted schema, keeping
 * every other constraint (and the stripped, pollution-safe output) intact.
 *
 * For the same reason, the value-inspecting refinements — complex
 * enum/const deep equality and minProperties/maxProperties counting — are
 * applied here on the raw input instead of by their usual handlers, which
 * skip schemas that constrain "__proto__": run on the stripped output,
 * they would reject inputs whose own "__proto__" key is significant.
 *
 * The schema's own "__proto__" property entry is read via
 * Object.getOwnPropertyDescriptor, and the input's key via descriptor /
 * Object.prototype.hasOwnProperty.call — the "__proto__" accessor itself is
 * never used.
 */
export class ProtoPropertyHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        if (!schemaConstrainsProtoProperty(schema)) {
            return zodSchema;
        }

        const objectSchema = schema as JSONSchema.ObjectSchema;

        const protoRequired = objectSchema.required?.includes("__proto__") ?? false;
        const protoPropertySchema =
            objectSchema.properties !== undefined
                ? Object.getOwnPropertyDescriptor(objectSchema.properties, "__proto__")?.value
                : undefined;

        const valueSchema =
            protoPropertySchema !== undefined ? convertJsonSchemaToZod(protoPropertySchema) : undefined;

        let rawSchema = z.any().refine(
            (value: unknown) => {
                if (!isConstrainableObject(value)) {
                    return true;
                }

                const descriptor = Object.getOwnPropertyDescriptor(value, "__proto__");
                if (descriptor === undefined) {
                    return !protoRequired;
                }

                return valueSchema === undefined || valueSchema.safeParse(descriptor.value).success;
            },
            { message: "__proto__ property validation failed" },
        );

        const complexEnumValues = getComplexEnumValues(schema);
        if (complexEnumValues.length > 0) {
            rawSchema = rawSchema.refine(
                (value: unknown) => matchesComplexEnumValue(value, complexEnumValues),
                { message: "Value must match one of the enum values" },
            );
        }

        const complexConstValue = getComplexConstValue(schema);
        if (complexConstValue !== undefined) {
            rawSchema = rawSchema.refine(
                (value: unknown) => deepEqual(value, complexConstValue),
                { message: "Value must equal the const value" },
            );
        }

        const { minProperties, maxProperties } = objectSchema;
        if (minProperties !== undefined) {
            rawSchema = rawSchema.refine(
                (value: unknown) =>
                    !isConstrainableObject(value) || Object.keys(value).length >= minProperties,
                { message: `Object must have at least ${minProperties} properties` },
            );
        }
        if (maxProperties !== undefined) {
            rawSchema = rawSchema.refine(
                (value: unknown) =>
                    !isConstrainableObject(value) || Object.keys(value).length <= maxProperties,
                { message: `Object must have at most ${maxProperties} properties` },
            );
        }

        return rawSchema.pipe(zodSchema);
    }
}
