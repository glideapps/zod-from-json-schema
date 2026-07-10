import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";

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
 * The schema's own "__proto__" property entry is read via
 * Object.getOwnPropertyDescriptor, and the input's key via descriptor /
 * Object.prototype.hasOwnProperty.call — the "__proto__" accessor itself is
 * never used.
 */
export class ProtoPropertyHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        const objectSchema = schema as JSONSchema.ObjectSchema;

        const protoRequired = objectSchema.required?.includes("__proto__") ?? false;
        const protoPropertySchema =
            objectSchema.properties !== undefined
                ? Object.getOwnPropertyDescriptor(objectSchema.properties, "__proto__")?.value
                : undefined;

        if (!protoRequired && protoPropertySchema === undefined) {
            return zodSchema;
        }

        const valueSchema =
            protoPropertySchema !== undefined ? convertJsonSchemaToZod(protoPropertySchema) : undefined;

        return z
            .any()
            .refine(
                (value: unknown) => {
                    // Object keywords only constrain objects.
                    if (typeof value !== "object" || value === null || Array.isArray(value)) {
                        return true;
                    }

                    const descriptor = Object.getOwnPropertyDescriptor(value, "__proto__");
                    if (descriptor === undefined) {
                        return !protoRequired;
                    }

                    return valueSchema === undefined || valueSchema.safeParse(descriptor.value).success;
                },
                { message: "__proto__ property validation failed" },
            )
            .pipe(zodSchema);
    }
}
