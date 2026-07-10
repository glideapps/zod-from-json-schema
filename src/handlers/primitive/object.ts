import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { PrimitiveHandler, TypeSchemas } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";
import { isHazardousPropertyName } from "../../core/utils";

export class PropertiesHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const objectSchema = schema as JSONSchema.ObjectSchema;

        // Only process if object is still allowed
        if (types.object === false) return;

        const hasPropertyKeywords =
            objectSchema.properties !== undefined ||
            (Array.isArray(objectSchema.required) && objectSchema.required.length > 0) ||
            objectSchema.additionalProperties !== undefined;

        if (!hasPropertyKeywords) {
            return;
        }

        const hasPatternProperties =
            objectSchema.patternProperties !== undefined &&
            typeof objectSchema.patternProperties === "object" &&
            Object.keys(objectSchema.patternProperties).length > 0;

        const requiredSet = new Set<string>(Array.isArray(objectSchema.required) ? objectSchema.required : []);

        // Properties whose names collide with Object.prototype members can't be
        // expressed in the shape; ObjectPropertiesHandler validates them with
        // own-property semantics instead.
        let hasHazardousProperties = false;

        const shape: Record<string, z.ZodTypeAny> = {};

        // Required keys whose presence the shape itself can't enforce: hazardous
        // names, keys without a property schema, and property schemas that accept
        // undefined (e.g. the empty schema), which Zod treats as satisfiable by a
        // missing key.
        const presenceCheckKeys: string[] = [];

        // Zod strips own "__proto__" keys from parse output for security, so
        // a "__proto__" property schema must be checked on the RAW input
        // (via the pipe below) rather than by ObjectPropertiesHandler.
        let protoValueSchema: z.ZodTypeAny | undefined;

        if (objectSchema.properties) {
            for (const [key, propSchema] of Object.entries(objectSchema.properties)) {
                if (propSchema === undefined) continue;

                if (isHazardousPropertyName(key)) {
                    hasHazardousProperties = true;
                    if (key === "__proto__") {
                        protoValueSchema = convertJsonSchemaToZod(propSchema);
                    }
                    if (requiredSet.delete(key)) {
                        presenceCheckKeys.push(key);
                    }
                    continue;
                }

                const propertyZod = convertJsonSchemaToZod(propSchema);
                if (requiredSet.delete(key)) {
                    shape[key] = propertyZod;
                    if (propertyZod.safeParse(undefined).success) {
                        presenceCheckKeys.push(key);
                    }
                } else {
                    shape[key] = propertyZod.optional();
                }
            }
        }

        // Required keys without a property schema: enforce presence only.
        for (const key of requiredSet) {
            presenceCheckKeys.push(key);
        }

        let objectZod: z.ZodObject<any> = z.object(shape);

        // With patternProperties or hazardous property names in play, the shape
        // alone can't decide which extra keys are allowed; ObjectPropertiesHandler
        // enforces additionalProperties in those cases, so stay permissive here.
        const deferUnknownKeys = hasPatternProperties || hasHazardousProperties;

        if (objectSchema.additionalProperties === false) {
            objectZod = deferUnknownKeys ? objectZod.passthrough() : objectZod.strict();
        } else if (typeof objectSchema.additionalProperties === "object") {
            objectZod = deferUnknownKeys
                ? objectZod.passthrough()
                : objectZod.catchall(convertJsonSchemaToZod(objectSchema.additionalProperties));
        } else {
            objectZod = objectZod.passthrough();
        }

        // Presence of required "__proto__" stays unenforced to keep the
        // documented required-__proto__ limitation consistent.
        // (ProtoRequiredHandler covers the untyped-schema case.)
        const enforcibleKeys = presenceCheckKeys.filter((key) => key !== "__proto__");

        if (enforcibleKeys.length > 0 || protoValueSchema !== undefined) {
            // Check the RAW input, before objectZod parses it: the parse
            // output can't distinguish a missing key from one materialized
            // by a `default` (and JSON Schema `required` must reject a
            // missing key even when its schema has a default), and Zod
            // strips own "__proto__" keys so their values are only visible
            // here. Non-objects pass through so objectZod rejects them with
            // its own error (the guard also keeps hasOwnProperty off null).
            const checkRawInput = (value: unknown): boolean => {
                if (typeof value !== "object" || value === null || Array.isArray(value)) {
                    return true;
                }
                if (!enforcibleKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key))) {
                    return false;
                }
                if (protoValueSchema !== undefined && Object.prototype.hasOwnProperty.call(value, "__proto__")) {
                    const protoValue = Object.getOwnPropertyDescriptor(value, "__proto__")!.value;
                    return protoValueSchema.safeParse(protoValue).success;
                }
                return true;
            };

            types.object = z
                .any()
                .refine(checkRawInput, {
                    message: "Object raw-input constraints validation failed",
                })
                .pipe(objectZod);
        } else {
            types.object = objectZod;
        }
    }
}

export class ImplicitObjectHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const objectSchema = schema as JSONSchema.ObjectSchema;
        
        // If no explicit type but object constraints are present, enable object type
        if (schema.type === undefined && 
            (objectSchema.maxProperties !== undefined || 
             objectSchema.minProperties !== undefined)) {
            
            if (types.object === undefined) {
                types.object = z.object({}).passthrough();
            }
        }
    }
}

export class MaxPropertiesHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const objectSchema = schema as JSONSchema.ObjectSchema;
        if (objectSchema.maxProperties === undefined) return;

        // Apply constraint when object type is enabled (explicit or implicit)
        if (types.object !== false) {
            const baseObject = types.object || z.object({}).passthrough();
            types.object = baseObject.refine(
                (obj: any) => Object.keys(obj).length <= objectSchema.maxProperties!,
                { message: `Object must have at most ${objectSchema.maxProperties} properties` }
            );
        }
    }
}

export class MinPropertiesHandler implements PrimitiveHandler {
    apply(types: TypeSchemas, schema: JSONSchema.BaseSchema): void {
        const objectSchema = schema as JSONSchema.ObjectSchema;
        if (objectSchema.minProperties === undefined) return;

        // Apply constraint when object type is enabled (explicit or implicit)
        if (types.object !== false) {
            const baseObject = types.object || z.object({}).passthrough();
            types.object = baseObject.refine(
                (obj: any) => Object.keys(obj).length >= objectSchema.minProperties!,
                { message: `Object must have at least ${objectSchema.minProperties} properties` }
            );
        }
    }
}
