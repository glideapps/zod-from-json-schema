import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { PrimitiveHandler, RefinementHandler, TypeSchemas } from "./types";

// Import primitive handlers
import { TypeHandler } from "../handlers/primitive/type";
import { ConstHandler } from "../handlers/primitive/const";
import { EnumHandler } from "../handlers/primitive/enum";
import { FileHandler } from "../handlers/primitive/file";
import {
    ImplicitStringHandler,
    MinLengthHandler,
    MaxLengthHandler,
    PatternHandler,
} from "../handlers/primitive/string";
import {
    MinimumHandler,
    MaximumHandler,
    ExclusiveMinimumHandler,
    ExclusiveMaximumHandler,
    MultipleOfHandler,
} from "../handlers/primitive/number";
import { ImplicitArrayHandler, MinItemsHandler, MaxItemsHandler, ItemsHandler } from "../handlers/primitive/array";
import { TupleHandler } from "../handlers/primitive/tuple";
import {
    PropertiesHandler,
    ImplicitObjectHandler,
    MaxPropertiesHandler,
    MinPropertiesHandler,
} from "../handlers/primitive/object";

// Import refinement handlers
import { NotHandler } from "../handlers/refinement/not";
import { UniqueItemsHandler } from "../handlers/refinement/uniqueItems";
import { AllOfHandler } from "../handlers/refinement/allOf";
import { AnyOfHandler } from "../handlers/refinement/anyOf";
import { OneOfHandler } from "../handlers/refinement/oneOf";
import { PrefixItemsHandler } from "../handlers/refinement/arrayItems";
import { ObjectPropertiesHandler } from "../handlers/refinement/objectProperties";
import { EnumComplexHandler } from "../handlers/refinement/enumComplex";
import { ConstComplexHandler } from "../handlers/refinement/constComplex";
import { MetadataHandler } from "../handlers/refinement/metadata";
import { ProtoRequiredHandler } from "../handlers/refinement/protoRequired";
import { ContainsHandler } from "../handlers/refinement/contains";
import { DefaultHandler } from "../handlers/refinement/default";

// Initialize handlers
const primitiveHandlers: PrimitiveHandler[] = [
    // Type constraints - should run first
    new ConstHandler(),
    new EnumHandler(),
    new TypeHandler(),

    // File schema detection - must run before string constraints
    new FileHandler(),

    // Implicit type detection - must run before other constraints
    new ImplicitStringHandler(),
    new ImplicitArrayHandler(),
    new ImplicitObjectHandler(),

    // String constraints
    new MinLengthHandler(),
    new MaxLengthHandler(),
    new PatternHandler(),

    // Number constraints
    new MinimumHandler(),
    new MaximumHandler(),
    new ExclusiveMinimumHandler(),
    new ExclusiveMaximumHandler(),
    new MultipleOfHandler(),

    // Array constraints - TupleHandler must run before ItemsHandler
    new TupleHandler(),
    new MinItemsHandler(),
    new MaxItemsHandler(),
    new ItemsHandler(),

    // Object constraints
    new MaxPropertiesHandler(),
    new MinPropertiesHandler(),
    new PropertiesHandler(),
];

const refinementHandlers: RefinementHandler[] = [
    // Handle special cases first
    new ProtoRequiredHandler(),
    new EnumComplexHandler(),
    new ConstComplexHandler(),

    // Logical combinations
    new AllOfHandler(),
    new AnyOfHandler(),
    new OneOfHandler(),

    // Type-specific refinements
    new PrefixItemsHandler(),
    new ObjectPropertiesHandler(),

    // Array refinements
    new ContainsHandler(),

    // Other refinements
    new NotHandler(),
    new UniqueItemsHandler(),
    new DefaultHandler(),

    // Metadata last
    new MetadataHandler(),
];

/**
 * Converts a JSON Schema object to a Zod schema using the two-phase architecture
 */
export function convertJsonSchemaToZod(schema: JSONSchema.BaseSchema | boolean): z.ZodTypeAny {
    // Handle boolean schemas
    if (typeof schema === "boolean") {
        return schema ? z.any() : z.never();
    }

    // Phase 1: Initialize type schemas and apply primitive handlers
    const types: TypeSchemas = {};

    for (const handler of primitiveHandlers) {
        handler.apply(types, schema);
    }

    // Build array of allowed type schemas
    const allowedSchemas: z.ZodTypeAny[] = [];

    if (types.string !== false) {
        allowedSchemas.push(types.string || z.string());
    }
    if (types.number !== false) {
        allowedSchemas.push(types.number || z.number());
    }
    if (types.boolean !== false) {
        allowedSchemas.push(types.boolean || z.boolean());
    }
    if (types.null !== false) {
        allowedSchemas.push(types.null || z.null());
    }
    if (types.array !== false) {
        allowedSchemas.push(types.array || z.array(z.any()));
    }
    if (types.tuple !== false && types.tuple !== undefined) {
        allowedSchemas.push(types.tuple);
    }
    if (types.object !== false) {
        if (types.object) {
            // Use the explicit object schema from handlers
            allowedSchemas.push(types.object);
        } else {
            // Use custom validator that rejects arrays for default object schema
            const objectSchema = z.custom<object>((val) => {
                return typeof val === "object" && val !== null && !Array.isArray(val);
            }, "Must be an object, not an array");
            allowedSchemas.push(objectSchema);
        }
    }
    if (types.file !== false && types.file !== undefined) {
        allowedSchemas.push(types.file);
    }

    // Create base schema
    let zodSchema: z.ZodTypeAny;
    if (allowedSchemas.length === 0) {
        zodSchema = z.never();
    } else if (allowedSchemas.length === 1) {
        zodSchema = allowedSchemas[0];
    } else {
        // Check if this is an unconstrained schema (all default types enabled)
        const hasConstraints = Object.keys(schema).some(
            (key) => key !== "$schema" && key !== "title" && key !== "description",
        );

        if (!hasConstraints) {
            // Empty schema with no constraints should be z.any()
            zodSchema = z.any();
        } else {
            zodSchema = z.union(allowedSchemas as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
        }
    }

    // Phase 2: Apply refinement handlers
    for (const handler of refinementHandlers) {
        zodSchema = handler.apply(zodSchema, schema);
    }

    return zodSchema;
}
