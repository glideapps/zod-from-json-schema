import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";
import { unwrapPreprocess } from "../../core/utils";

export class ObjectPropertiesHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        const objectSchema = schema as JSONSchema.ObjectSchema;
        
        // Skip if no object-specific constraints
        if (!objectSchema.properties && !objectSchema.required && objectSchema.additionalProperties !== false) {
            return zodSchema;
        }

        const propertyEntries = objectSchema.properties
            ? Object.entries(objectSchema.properties).filter(([, propSchema]) => propSchema !== undefined)
            : [];
        // Cache converted property schemas so we only pay the conversion cost once per property.
        const propertySchemas = new Map<string, z.ZodTypeAny>();
        for (const [propName, propSchema] of propertyEntries) {
            propertySchemas.set(propName, convertJsonSchemaToZod(propSchema));
        }

        // Precompile patternProperties so each additional key can be checked cheaply.
        const patternEntries =
            objectSchema.patternProperties && typeof objectSchema.patternProperties === "object"
                ? Object.entries(objectSchema.patternProperties)
                      .filter(([, patternSchema]) => patternSchema !== undefined)
                      .map(([pattern, patternSchema]) => {
                          try {
                              return {
                                  regex: new RegExp(pattern),
                                  schema: convertJsonSchemaToZod(patternSchema),
                              };
                          } catch {
                              return undefined;
                          }
                      })
                      .filter((entry): entry is { regex: RegExp; schema: z.ZodTypeAny } => entry !== undefined)
                : [];

        const additionalSchema =
            objectSchema.additionalProperties && typeof objectSchema.additionalProperties === "object"
                ? convertJsonSchemaToZod(objectSchema.additionalProperties)
                : undefined;

        const allowsAdditional =
            objectSchema.additionalProperties === undefined || objectSchema.additionalProperties === true;

        const unwrappedSchema = unwrapPreprocess(zodSchema); // Removes preprocessing wrappers so object detection works for sanitized schemas.
        const isDirectObject = unwrappedSchema instanceof z.ZodObject || unwrappedSchema instanceof z.ZodRecord;
        const hasPatternConstraints = patternEntries.length > 0;
        const needsAdditionalFalseRefinement =
            objectSchema.additionalProperties === false && hasPatternConstraints;
        const needsAdditionalSchemaRefinement = additionalSchema !== undefined && !isDirectObject;

        const requiresRefinementForObject =
            hasPatternConstraints || needsAdditionalSchemaRefinement || needsAdditionalFalseRefinement;

        if (isDirectObject && !requiresRefinementForObject) {
            return zodSchema;
        }

        return zodSchema.refine(
            (value: any) => {
                // Only apply object constraints to objects
                if (typeof value !== "object" || value === null || Array.isArray(value)) {
                    return true; // Non-objects pass through
                }

                // Apply properties constraint
                for (const [propName] of propertyEntries) {
                    if (!Object.prototype.hasOwnProperty.call(value, propName)) {
                        continue;
                    }

                    const propValue = (value as Record<string, unknown>)[propName];
                    const zodPropSchema = propertySchemas.get(propName)!;
                    if (!zodPropSchema.safeParse(propValue).success) {
                        return false;
                    }
                }

                // Apply required constraint
                if (objectSchema.required && Array.isArray(objectSchema.required)) {
                    for (const requiredProp of objectSchema.required) {
                        // Use robust property detection for required props too
                        if (!Object.prototype.hasOwnProperty.call(value, requiredProp)) {
                            return false;
                        }
                    }
                }

                // Apply additionalProperties constraint
                const knownPropertyNames = new Set(propertyEntries.map(([key]) => key));
                for (const [key, propValue] of Object.entries(value as Record<string, unknown>)) {
                    if (knownPropertyNames.has(key)) {
                        continue;
                    }

                    const matchingPatterns = patternEntries.filter((entry) => entry.regex.test(key));
                    if (matchingPatterns.length > 0) {
                        for (const entry of matchingPatterns) {
                            if (!entry.schema.safeParse(propValue).success) {
                                return false;
                            }
                        }
                        continue;
                    }

                    if (objectSchema.additionalProperties === false) {
                        return false;
                    }

                    if (additionalSchema) {
                        if (!additionalSchema.safeParse(propValue).success) {
                            return false;
                        }
                        continue;
                    }

                    if (!allowsAdditional) {
                        return false;
                    }
                }

                return true;
            },
            { message: "Object constraints validation failed" }
        );
    }
}
