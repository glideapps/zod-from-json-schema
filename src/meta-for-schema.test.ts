import { describe, it, expect, vi } from "vitest";
import { convertJsonSchemaToZod, jsonSchemaObjectToZodRawShape } from "./index";
import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";

/**
 * Example metaForSchema callback: collects all "x-" prefixed keys from a
 * schema node, returning undefined when there are none.
 */
function xKeysMeta(schema: JSONSchema.BaseSchema): Record<string, unknown> | undefined {
    const meta: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema)) {
        if (key.startsWith("x-")) {
            meta[key] = value;
        }
    }
    return Object.keys(meta).length > 0 ? meta : undefined;
}

describe("metaForSchema option", () => {
    describe("top-level schemas", () => {
        it("should attach returned metadata to the resulting Zod schema", () => {
            const zodSchema = convertJsonSchemaToZod(
                { type: "string", "x-ui-label": "Name", "x-form-position": 1 },
                { metaForSchema: xKeysMeta },
            );

            expect(zodSchema.meta()).toEqual({ "x-ui-label": "Name", "x-form-position": 1 });
            expect(zodSchema.safeParse("hello").success).toBe(true);
            expect(zodSchema.safeParse(42).success).toBe(false);
        });

        it("should merge metadata with the schema description", () => {
            const zodSchema = convertJsonSchemaToZod(
                { type: "string", description: "User name", "x-ui-label": "Name" },
                { metaForSchema: xKeysMeta },
            );

            expect(zodSchema.description).toBe("User name");
            expect(zodSchema.meta()).toEqual({ description: "User name", "x-ui-label": "Name" });
        });

        it("should let a description returned by the callback win over the schema description", () => {
            const zodSchema = convertJsonSchemaToZod(
                { type: "string", description: "original" },
                { metaForSchema: () => ({ description: "override" }) },
            );

            expect(zodSchema.description).toBe("override");
        });

        it("should not attach metadata when the callback returns undefined", () => {
            const zodSchema = convertJsonSchemaToZod({ type: "string" }, { metaForSchema: () => undefined });

            expect(zodSchema.meta()).toBeUndefined();
        });

        it("should not attach metadata when the callback returns an empty object", () => {
            const zodSchema = convertJsonSchemaToZod({ type: "string" }, { metaForSchema: () => ({}) });

            expect(zodSchema.meta()).toBeUndefined();
        });

        it("should preserve the description when the callback returns nothing", () => {
            const zodSchema = convertJsonSchemaToZod(
                { type: "string", description: "User name" },
                { metaForSchema: () => undefined },
            );

            expect(zodSchema.description).toBe("User name");
        });

        it("should not attach metadata when no options are passed", () => {
            const zodSchema = convertJsonSchemaToZod({ type: "string", "x-ui-label": "Name" });

            expect(zodSchema.meta()).toBeUndefined();
        });

        it("should round-trip custom keys through z.toJSONSchema", () => {
            const jsonSchema = {
                type: "string",
                description: "User name",
                "x-ui-label": "Name",
                "x-form-position": 1,
            } as const;

            const zodSchema = convertJsonSchemaToZod(jsonSchema, { metaForSchema: xKeysMeta });
            const result = z.toJSONSchema(zodSchema);

            expect(result).toEqual({
                $schema: "https://json-schema.org/draft/2020-12/schema",
                ...jsonSchema,
            });
        });
    });

    describe("boolean schemas", () => {
        it("should not invoke the callback for top-level boolean schemas", () => {
            const metaForSchema = vi.fn(() => ({ "x-a": 1 }));

            const trueSchema = convertJsonSchemaToZod(true, { metaForSchema });
            const falseSchema = convertJsonSchemaToZod(false, { metaForSchema });

            expect(metaForSchema).not.toHaveBeenCalled();
            expect(trueSchema.meta()).toBeUndefined();
            expect(falseSchema.meta()).toBeUndefined();
        });

        it("should not invoke the callback for nested boolean schemas", () => {
            const seen: JSONSchema.BaseSchema[] = [];
            const metaForSchema = (schema: JSONSchema.BaseSchema) => {
                seen.push(schema);
                return undefined;
            };

            convertJsonSchemaToZod(
                {
                    type: "object",
                    properties: { anything: true },
                },
                { metaForSchema },
            );

            expect(seen).not.toContain(true);
        });
    });

    describe("nested schemas", () => {
        it("should attach metadata to object property schemas", () => {
            const zodSchema = convertJsonSchemaToZod(
                {
                    type: "object",
                    properties: {
                        name: { type: "string", "x-ui-label": "Name" },
                        age: { type: "integer", "x-ui-label": "Age" },
                    },
                    required: ["name"],
                },
                { metaForSchema: xKeysMeta },
            ) as z.ZodObject<any>;

            expect(zodSchema.shape.name.meta()).toEqual({ "x-ui-label": "Name" });
            // Optional properties are wrapped in ZodOptional; the metadata
            // lives on the inner type.
            expect(zodSchema.shape.age.unwrap().meta()).toEqual({ "x-ui-label": "Age" });
        });

        it("should round-trip custom keys on object properties through z.toJSONSchema", () => {
            const zodSchema = convertJsonSchemaToZod(
                {
                    type: "object",
                    properties: {
                        name: { type: "string", "x-ui-label": "Name" },
                    },
                    required: ["name"],
                    additionalProperties: false,
                },
                { metaForSchema: xKeysMeta },
            );

            const result = z.toJSONSchema(zodSchema) as any;
            expect(result.properties.name["x-ui-label"]).toBe("Name");
        });

        it("should attach metadata to array item schemas", () => {
            const zodSchema = convertJsonSchemaToZod(
                {
                    type: "array",
                    items: { type: "string", "x-kind": "tag" },
                },
                { metaForSchema: xKeysMeta },
            ) as z.ZodArray<any>;

            expect(zodSchema.element.meta()).toEqual({ "x-kind": "tag" });
        });

        it("should invoke the callback for anyOf member schemas", () => {
            const seen: JSONSchema.BaseSchema[] = [];
            const metaForSchema = (schema: JSONSchema.BaseSchema) => {
                seen.push(schema);
                return xKeysMeta(schema);
            };

            const zodSchema = convertJsonSchemaToZod(
                {
                    anyOf: [
                        { type: "string", "x-a": 1 },
                        { type: "number", "x-b": 2 },
                    ],
                },
                { metaForSchema },
            );

            expect(seen).toContainEqual({ type: "string", "x-a": 1 });
            expect(seen).toContainEqual({ type: "number", "x-b": 2 });
            expect(zodSchema.safeParse("hello").success).toBe(true);
            expect(zodSchema.safeParse(42).success).toBe(true);
            expect(zodSchema.safeParse(true).success).toBe(false);
        });

        it("should invoke the callback for single-member anyOf schemas", () => {
            const seen: JSONSchema.BaseSchema[] = [];
            const metaForSchema = (schema: JSONSchema.BaseSchema) => {
                seen.push(schema);
                return undefined;
            };

            convertJsonSchemaToZod({ anyOf: [{ type: "string", "x-a": 1 }] }, { metaForSchema });

            expect(seen).toContainEqual({ type: "string", "x-a": 1 });
        });

        it("should invoke the callback for oneOf member schemas", () => {
            const seen: JSONSchema.BaseSchema[] = [];
            const metaForSchema = (schema: JSONSchema.BaseSchema) => {
                seen.push(schema);
                return undefined;
            };

            convertJsonSchemaToZod(
                {
                    oneOf: [
                        { type: "string", "x-a": 1 },
                        { type: "number", "x-b": 2 },
                    ],
                },
                { metaForSchema },
            );

            expect(seen).toContainEqual({ type: "string", "x-a": 1 });
            expect(seen).toContainEqual({ type: "number", "x-b": 2 });
        });

        it("should invoke the callback for allOf member schemas", () => {
            const seen: JSONSchema.BaseSchema[] = [];
            const metaForSchema = (schema: JSONSchema.BaseSchema) => {
                seen.push(schema);
                return undefined;
            };

            convertJsonSchemaToZod(
                {
                    allOf: [{ type: "string", "x-a": 1 }, { minLength: 2 }],
                },
                { metaForSchema },
            );

            expect(seen).toContainEqual({ type: "string", "x-a": 1 });
            expect(seen).toContainEqual({ minLength: 2 });
        });

        it("should invoke the callback for not schemas", () => {
            const seen: JSONSchema.BaseSchema[] = [];
            const metaForSchema = (schema: JSONSchema.BaseSchema) => {
                seen.push(schema);
                return undefined;
            };

            convertJsonSchemaToZod({ not: { type: "string", "x-a": 1 } }, { metaForSchema });

            expect(seen).toContainEqual({ type: "string", "x-a": 1 });
        });

        it("should invoke the callback for contains schemas", () => {
            const seen: JSONSchema.BaseSchema[] = [];
            const metaForSchema = (schema: JSONSchema.BaseSchema) => {
                seen.push(schema);
                return undefined;
            };

            convertJsonSchemaToZod(
                {
                    type: "array",
                    contains: { type: "number", "x-a": 1 },
                },
                { metaForSchema },
            );

            expect(seen).toContainEqual({ type: "number", "x-a": 1 });
        });

        it("should invoke the callback for prefixItems schemas", () => {
            const seen: JSONSchema.BaseSchema[] = [];
            const metaForSchema = (schema: JSONSchema.BaseSchema) => {
                seen.push(schema);
                return undefined;
            };

            convertJsonSchemaToZod(
                {
                    type: "array",
                    prefixItems: [{ type: "string", "x-a": 1 }, { type: "number" }],
                    items: { type: "boolean", "x-b": 2 },
                },
                { metaForSchema },
            );

            expect(seen).toContainEqual({ type: "string", "x-a": 1 });
            expect(seen).toContainEqual({ type: "boolean", "x-b": 2 });
        });

        it("should invoke the callback for tuple item schemas (legacy items array)", () => {
            const seen: JSONSchema.BaseSchema[] = [];
            const metaForSchema = (schema: JSONSchema.BaseSchema) => {
                seen.push(schema);
                return undefined;
            };

            convertJsonSchemaToZod(
                {
                    type: "array",
                    items: [{ type: "string", "x-a": 1 }, { type: "number" }],
                },
                { metaForSchema },
            );

            expect(seen).toContainEqual({ type: "string", "x-a": 1 });
        });

        it("should invoke the callback for patternProperties and additionalProperties schemas", () => {
            const seen: JSONSchema.BaseSchema[] = [];
            const metaForSchema = (schema: JSONSchema.BaseSchema) => {
                seen.push(schema);
                return undefined;
            };

            convertJsonSchemaToZod(
                {
                    type: "object",
                    properties: { a: { type: "string" } },
                    patternProperties: { "^x-": { type: "number", "x-a": 1 } },
                    additionalProperties: { type: "boolean", "x-b": 2 },
                },
                { metaForSchema },
            );

            expect(seen).toContainEqual({ type: "number", "x-a": 1 });
            expect(seen).toContainEqual({ type: "boolean", "x-b": 2 });
        });
    });

    describe("jsonSchemaObjectToZodRawShape", () => {
        it("should pass options through to property conversions", () => {
            const raw = jsonSchemaObjectToZodRawShape(
                {
                    type: "object",
                    properties: {
                        name: { type: "string", "x-ui-label": "Name" },
                        age: { type: "integer", "x-ui-label": "Age" },
                    },
                    required: ["name"],
                },
                { metaForSchema: xKeysMeta },
            );

            expect((raw.name as z.ZodTypeAny).meta()).toEqual({ "x-ui-label": "Name" });
            // Non-required properties are wrapped in ZodOptional.
            expect((raw.age as z.ZodOptional<z.ZodTypeAny>).unwrap().meta()).toEqual({ "x-ui-label": "Age" });
        });

        it("should not attach metadata when no options are passed", () => {
            const raw = jsonSchemaObjectToZodRawShape({
                type: "object",
                properties: { name: { type: "string", "x-ui-label": "Name" } },
                required: ["name"],
            });

            expect((raw.name as z.ZodTypeAny).meta()).toBeUndefined();
        });
    });

    describe("issue #32 example", () => {
        it("should preserve custom metadata fields from the issue example", () => {
            const jsonSchema = {
                type: "string",
                description: "User name",
                "x-ui-label": "Name",
                "x-form-position": 1,
            };

            const zodSchema = convertJsonSchemaToZod(jsonSchema, { metaForSchema: xKeysMeta });

            expect(zodSchema.meta()).toEqual({
                description: "User name",
                "x-ui-label": "Name",
                "x-form-position": 1,
            });
        });
    });
});
