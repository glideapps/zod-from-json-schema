import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { PrimitiveHandler, TypeSchemas } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";

// Clone incoming objects onto a null-prototype so JSON Schema keywords can see "__proto__" et al. as real properties without mutating the original input.
function sanitizeObjectInput(input: unknown): unknown {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
        return input;
    }

    const source = input as Record<PropertyKey, unknown>;
    const target: Record<PropertyKey, unknown> = Object.create(null);

    // A plain assignment is enough—accessor properties will resolve through the original object,
    // and all own keys (including "__proto__" and symbols) are preserved.
    for (const key of Reflect.ownKeys(source)) {
        target[key] = source[key];
    }

    return target;
}

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

        // Track whether patternProperties will supply their own allowance so we avoid locking the schema down too early.
        const hasPatternProperties =
            objectSchema.patternProperties !== undefined &&
            typeof objectSchema.patternProperties === "object" &&
            Object.keys(objectSchema.patternProperties).length > 0;

        const requiredSet = Array.isArray(objectSchema.required)
            ? new Set<string>(objectSchema.required)
            : undefined;

        const shape: Record<string, z.ZodTypeAny> = {};

        if (objectSchema.properties) {
            for (const [key, propSchema] of Object.entries(objectSchema.properties)) {
                if (propSchema === undefined) continue;

                const propertyZod = convertJsonSchemaToZod(propSchema);
                const isRequired = requiredSet ? requiredSet.has(key) : false;

                if (requiredSet) {
                    requiredSet.delete(key);
                }

                shape[key] = isRequired ? propertyZod : propertyZod.optional();
            }
        }

        if (requiredSet && requiredSet.size > 0) {
            for (const key of requiredSet) {
                shape[key] = z.any();
            }
        }

        let objectZod = z.object(shape);

        if (objectSchema.additionalProperties === false) {
            objectZod = hasPatternProperties ? objectZod.passthrough() : objectZod.strict();
        } else if (
            objectSchema.additionalProperties !== undefined &&
            objectSchema.additionalProperties !== true
        ) {
            if (typeof objectSchema.additionalProperties === "object") {
                const additionalSchema = convertJsonSchemaToZod(objectSchema.additionalProperties);
                objectZod = hasPatternProperties ? objectZod.passthrough() : objectZod.catchall(additionalSchema);
            } else {
                objectZod = objectZod.passthrough();
            }
        } else {
            objectZod = objectZod.passthrough();
        }

        // Preprocess ensures downstream refinements receive the sanitized clone while preserving the high-level object shape.
        const objectWithPreprocess = z.preprocess(sanitizeObjectInput, objectZod);

        types.object = objectWithPreprocess;
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
