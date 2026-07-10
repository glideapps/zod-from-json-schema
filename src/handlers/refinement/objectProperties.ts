import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
import { convertJsonSchemaToZod } from "../../core/converter";
import { isHazardousPropertyName } from "../../core/utils";

export class ObjectPropertiesHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny {
        const objectSchema = schema as JSONSchema.ObjectSchema;

        const hasPatternConstraints =
            objectSchema.patternProperties !== undefined &&
            typeof objectSchema.patternProperties === "object" &&
            Object.keys(objectSchema.patternProperties).length > 0;

        const hasAdditionalPropertiesSchema =
            typeof objectSchema.additionalProperties === "object" && objectSchema.additionalProperties !== null;

        // Skip if no object-specific constraints
        if (
            !objectSchema.properties &&
            !objectSchema.required &&
            objectSchema.additionalProperties !== false &&
            !hasAdditionalPropertiesSchema &&
            !hasPatternConstraints
        ) {
            return zodSchema;
        }

        const propertyEntries = objectSchema.properties
            ? Object.entries(objectSchema.properties).filter(([, propSchema]) => propSchema !== undefined)
            : [];

        // Properties named like Object.prototype members were left out of the
        // object shape built by PropertiesHandler; they are validated here with
        // own-property semantics. Exception: "__proto__" values still can't be
        // checked, because Zod strips own "__proto__" keys from the parse
        // output this refinement runs on.
        const hasHazardousProperties = propertyEntries.some(([propName]) => isHazardousPropertyName(propName));

        // A plain object schema already enforces properties, required, and
        // additionalProperties through its shape, so refinement is only needed
        // for constraints the shape can't express.
        const isDirectObject = zodSchema instanceof z.ZodObject || zodSchema instanceof z.ZodRecord;
        if (isDirectObject && !hasPatternConstraints && !hasHazardousProperties) {
            return zodSchema;
        }

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
                    // A key matching patternProperties must satisfy every
                    // matching pattern schema, even when the key is also
                    // declared in properties.
                    const matchingPatterns = patternEntries.filter((entry) => entry.regex.test(key));
                    for (const entry of matchingPatterns) {
                        if (!entry.schema.safeParse(propValue).success) {
                            return false;
                        }
                    }

                    // Keys covered by properties or patternProperties are
                    // not "additional".
                    if (knownPropertyNames.has(key) || matchingPatterns.length > 0) {
                        continue;
                    }

                    if (objectSchema.additionalProperties === false) {
                        return false;
                    }

                    if (additionalSchema && !additionalSchema.safeParse(propValue).success) {
                        return false;
                    }
                }

                return true;
            },
            { message: "Object constraints validation failed" }
        );
    }
}
