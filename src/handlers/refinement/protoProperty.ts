import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";
import { convertSchemaRefs } from "../../core/refs";
import { deepEqual, isValidWithSchema } from "../../core/utils";

/**
 * Checks whether a schema constrains an own "__proto__" key, via `required`
 * or a `properties` entry. The `properties` entry is read via
 * Object.getOwnPropertyDescriptor; the "__proto__" accessor itself is never
 * used. The boolean `true` schema constrains nothing, so it doesn't count —
 * the reduced schema built below relies on that to avoid re-entering the
 * handler.
 */
function schemaConstrainsProtoProperty(schema: JSONSchema.BaseSchema): boolean {
    const objectSchema = schema as JSONSchema.ObjectSchema;
    if (objectSchema.required?.includes("__proto__")) return true;
    if (objectSchema.properties === undefined) return false;
    const propertySchema = Object.getOwnPropertyDescriptor(objectSchema.properties, "__proto__")?.value;
    return propertySchema !== undefined && propertySchema !== true;
}

/**
 * Checks whether object keywords apply to a value: JSON Schema object
 * keywords only constrain objects (and not arrays).
 */
function isConstrainableObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates "__proto__" entries in `properties` and `required` against the
 * RAW input, before Zod's object parsing runs.
 *
 * This must happen outside the converted schema because Zod strips own
 * "__proto__" keys from its parse output as a prototype-pollution defense,
 * so any refinement running on that output can never see the key. For
 * schemas that constrain "__proto__", the converted schema is therefore
 * replaced wholesale: a reduced copy of the JSON schema — with "__proto__"
 * dropped from `required`, its `properties` entry relaxed to `true` (so it
 * still counts as a declared property for `additionalProperties`), and
 * without keywords that must observe raw object keys (`enum`, `const`,
 * `minProperties`, `maxProperties`, `propertyNames`, `dependentRequired`,
 * `dependentSchemas`, and sibling references) — is converted normally, and
 * the constraints removed from it are checked on the raw input in front of
 * it. z.any() passes the input through
 * untouched, so the checks observe the own "__proto__" key; `.pipe()` then
 * runs the reduced schema, keeping every other constraint (and the
 * stripped, pollution-safe output) intact.
 *
 * The schema's own "__proto__" property entry is read via
 * Object.getOwnPropertyDescriptor, and the input's key likewise — the
 * "__proto__" accessor itself is never used. The reduced schema no longer
 * constrains "__proto__", so its conversion does not re-enter this handler.
 */
export class ProtoPropertyHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        if (!schemaConstrainsProtoProperty(schema)) {
            return zodSchema;
        }

        const objectSchema = schema as JSONSchema.ObjectSchema & {
            dependentSchemas?: Record<string, JSONSchema.BaseSchema | boolean | undefined>;
        };
        const {
            enum: enumValues,
            const: constValue,
            minProperties,
            maxProperties,
            required,
            properties,
            propertyNames,
            dependentRequired,
            dependentSchemas,
            ...rest
        } = objectSchema;

        // Build the reduced schema without ever touching a "__proto__"
        // accessor: rest/spread and Object.fromEntries both create keys with
        // define semantics. The "__proto__" property entry is relaxed to the
        // boolean `true` schema rather than removed, so the reduced schema
        // still treats it as a declared property (for additionalProperties)
        // without constraining it.
        const reduced: JSONSchema.ObjectSchema = { ...rest };
        if (required !== undefined) {
            reduced.required = required.filter((name) => name !== "__proto__");
        }
        if (properties !== undefined) {
            reduced.properties = Object.fromEntries(
                Object.entries(properties).map(([name, propertySchema]) =>
                    name === "__proto__" ? [name, true] : [name, propertySchema],
                ),
            );
        }
        // An empty `enum` is special-cased by type in the primitive
        // EnumHandler and can't be affected by own "__proto__" keys, so it
        // stays in the reduced schema; non-empty enums are checked raw.
        const rawEnum = enumValues !== undefined && enumValues.length > 0 ? enumValues : undefined;
        if (rawEnum === undefined && enumValues !== undefined) {
            reduced.enum = enumValues;
        }
        // References on the copied node no longer have a document-analysis
        // identity, and must inspect the raw value anyway. Resolve them from
        // the original node, then omit them from the reduced conversion.
        const rawRefs = convertSchemaRefs(schema);
        delete (reduced as any).$ref;
        delete (reduced as any).$dynamicRef;

        const protoRequired = required?.includes("__proto__") ?? false;
        const protoPropertySchema =
            properties !== undefined
                ? Object.getOwnPropertyDescriptor(properties, "__proto__")?.value
                : undefined;
        const protoValueSchema =
            protoPropertySchema !== undefined ? convertJsonSchemaToZod(protoPropertySchema) : undefined;
        const propertyNameSchema =
            propertyNames !== undefined ? convertJsonSchemaToZod(propertyNames) : undefined;
        const dependentRequiredEntries =
            dependentRequired !== undefined ? Object.entries(dependentRequired) : [];
        const dependentSchemasEntries =
            dependentSchemas !== undefined
                ? Object.entries(dependentSchemas)
                      .filter(([, dependentSchema]) => dependentSchema !== undefined)
                      .map(
                          ([name, dependentSchema]) =>
                              [
                                  name,
                                  convertJsonSchemaToZod(
                                      dependentSchema as JSONSchema.BaseSchema | boolean,
                                  ),
                              ] as const,
                      )
                : [];

        return z
            .any()
            .superRefine((value: unknown, ctx) => {
                if (isConstrainableObject(value)) {
                    const descriptor = Object.getOwnPropertyDescriptor(value, "__proto__");
                    if (descriptor === undefined) {
                        if (protoRequired) {
                            ctx.addIssue({ code: "custom", message: "__proto__ property validation failed" });
                        }
                    } else if (
                        protoValueSchema !== undefined &&
                        !protoValueSchema.safeParse(descriptor.value).success
                    ) {
                        ctx.addIssue({ code: "custom", message: "__proto__ property validation failed" });
                    }

                    const propertyCount = Object.keys(value).length;
                    if (minProperties !== undefined && propertyCount < minProperties) {
                        ctx.addIssue({
                            code: "custom",
                            message: `Object must have at least ${minProperties} properties`,
                        });
                    }
                    if (maxProperties !== undefined && propertyCount > maxProperties) {
                        ctx.addIssue({
                            code: "custom",
                            message: `Object must have at most ${maxProperties} properties`,
                        });
                    }

                    if (
                        propertyNameSchema !== undefined &&
                        !Object.keys(value).every((name) => propertyNameSchema.safeParse(name).success)
                    ) {
                        ctx.addIssue({ code: "custom", message: "Property names validation failed" });
                    }
                    if (
                        !dependentRequiredEntries.every(
                            ([name, dependents]) =>
                                !Object.prototype.hasOwnProperty.call(value, name) ||
                                dependents.every((dependent) =>
                                    Object.prototype.hasOwnProperty.call(value, dependent),
                                ),
                        )
                    ) {
                        ctx.addIssue({
                            code: "custom",
                            message: "Missing dependent required properties",
                        });
                    }
                    if (
                        !dependentSchemasEntries.every(
                            ([name, dependentSchema]) =>
                                !Object.prototype.hasOwnProperty.call(value, name) ||
                                isValidWithSchema(dependentSchema, value),
                        )
                    ) {
                        ctx.addIssue({
                            code: "custom",
                            message: "Value does not satisfy a dependent schema",
                        });
                    }
                }

                if (rawEnum !== undefined && !rawEnum.some((member) => deepEqual(value, member))) {
                    ctx.addIssue({ code: "custom", message: "Value must match one of the enum values" });
                }
                if (constValue !== undefined && !deepEqual(value, constValue)) {
                    ctx.addIssue({ code: "custom", message: "Value must equal the const value" });
                }
                if (!rawRefs.every(({ schema: targetSchema }) => targetSchema.safeParse(value).success)) {
                    ctx.addIssue({ code: "custom", message: "Value does not match referenced schema" });
                }
            })
            .pipe(convertJsonSchemaToZod(reduced));
    }
}
