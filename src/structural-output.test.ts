import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { convertJsonSchemaToZod } from "./index";

/**
 * Structural output regression tests.
 *
 * The converter produces "nice" structural Zod types (z.string(),
 * z.object(...), ...) wherever it can, and only falls back to opaque
 * refinements on z.any() where it must. These tests pin that niceness by
 * round-tripping converted schemas through Zod's own JSON Schema emitter,
 * z.toJSONSchema: structural types round-trip to meaningful JSON Schema,
 * while a z.any().refine(...) chain degrades to the empty schema {}. If a
 * future change accidentally turns a structural conversion into a
 * refinement on z.any(), the expected structure disappears and these tests
 * fail loudly.
 *
 * z.toJSONSchema behavior (zod 4.0.17, verified experimentally):
 * - Custom .refine(...) checks are silently ignored (never throw), so
 *   emission is stable for refinement-based constraints and the base type
 *   still round-trips: z.string().refine(...) -> {type: "string"}.
 * - { unrepresentable: "any" } is passed defensively so structural
 *   assertions don't depend on every part being representable; since #63
 *   the converter avoids z.custom(...) entirely, and the strict-emission
 *   tests below verify serialization without the option.
 * - The io option defaults to "output". For ZodPipe (the required-with-
 *   default handling from #51) the output side carries the structural
 *   object schema, whereas io: "input" degrades to {}; we rely on the
 *   default. ZodDefault emits {type: ..., default: ...} on both io sides.
 * - ZodIntersection emits allOf, ZodUnion emits anyOf.
 */

/**
 * Converts a JSON Schema and emits the result back to JSON Schema via
 * z.toJSONSchema, stripped of the $schema marker.
 */
function roundTrip(schema: unknown): Record<string, unknown> {
    const converted = convertJsonSchemaToZod(schema as any);
    const { $schema, ...rest } = z.toJSONSchema(converted, { unrepresentable: "any" });
    return rest;
}

interface StructuralCase {
    name: string;
    schema: Record<string, unknown>;
    expected: Record<string, unknown>;
    /** true: toEqual (exact); false: toMatchObject (structural subset). */
    exact: boolean;
}

const structuralCases: StructuralCase[] = [
    {
        name: "string",
        schema: { type: "string" },
        expected: { type: "string" },
        exact: true,
    },
    {
        // minLength/maxLength are intentionally enforced via grapheme-
        // cluster-aware refinements (not z.string().min/max), so they do
        // not round-trip; the base type and pattern must survive.
        name: "string with length bounds and pattern",
        schema: { type: "string", minLength: 2, maxLength: 5, pattern: "^a" },
        expected: { type: "string", pattern: "^a" },
        exact: false,
    },
    {
        name: "number with bounds",
        schema: { type: "number", minimum: 0, maximum: 10 },
        expected: { type: "number", minimum: 0, maximum: 10 },
        exact: true,
    },
    {
        name: "number with exclusive bounds",
        schema: { type: "number", exclusiveMinimum: 0, exclusiveMaximum: 10 },
        expected: { type: "number", exclusiveMinimum: 0, exclusiveMaximum: 10 },
        exact: true,
    },
    {
        // z.number().int() adds safe-integer bounds; only pin the type so
        // the exact bound values stay zod's business.
        name: "integer",
        schema: { type: "integer" },
        expected: { type: "integer" },
        exact: false,
    },
    {
        name: "boolean",
        schema: { type: "boolean" },
        expected: { type: "boolean" },
        exact: true,
    },
    {
        name: "null",
        schema: { type: "null" },
        expected: { type: "null" },
        exact: true,
    },
    {
        name: "string enum",
        schema: { enum: ["a", "b", "c"] },
        expected: { type: "string", enum: ["a", "b", "c"] },
        exact: true,
    },
    {
        name: "mixed-type enum",
        schema: { enum: ["a", 1] },
        expected: {
            anyOf: [
                { type: "string", const: "a" },
                { type: "number", const: 1 },
            ],
        },
        exact: true,
    },
    {
        name: "string const",
        schema: { const: "fixed" },
        expected: { type: "string", const: "fixed" },
        exact: true,
    },
    {
        name: "number const",
        schema: { const: 42 },
        expected: { type: "number", const: 42 },
        exact: true,
    },
    {
        name: "object with properties and required",
        schema: {
            type: "object",
            properties: { name: { type: "string" }, age: { type: "number" } },
            required: ["name"],
        },
        expected: {
            type: "object",
            properties: { name: { type: "string" }, age: { type: "number" } },
            required: ["name"],
        },
        exact: false,
    },
    {
        name: "nested object",
        schema: {
            type: "object",
            properties: {
                inner: {
                    type: "object",
                    properties: { flag: { type: "boolean" } },
                    required: ["flag"],
                },
            },
        },
        expected: {
            type: "object",
            properties: {
                inner: {
                    type: "object",
                    properties: { flag: { type: "boolean" } },
                    required: ["flag"],
                },
            },
        },
        exact: false,
    },
    {
        name: "object with additionalProperties: false",
        schema: {
            type: "object",
            properties: { a: { type: "string" } },
            additionalProperties: false,
        },
        expected: {
            type: "object",
            properties: { a: { type: "string" } },
            additionalProperties: false,
        },
        exact: false,
    },
    {
        name: "array with items",
        schema: { type: "array", items: { type: "string" } },
        expected: { type: "array", items: { type: "string" } },
        exact: true,
    },
    {
        name: "type array union",
        schema: { type: ["string", "number"] },
        expected: { anyOf: [{ type: "string" }, { type: "number" }] },
        exact: true,
    },
    {
        // The unconstrained schema is genuinely "anything"; {} is correct
        // here, not a degradation.
        name: "empty schema",
        schema: {},
        expected: {},
        exact: true,
    },
];

describe("structural output survives z.toJSONSchema round-trips", () => {
    it.each(structuralCases)("$name", ({ schema, expected, exact }) => {
        const emitted = roundTrip(schema);
        if (exact) {
            expect(emitted).toEqual(expected);
        } else {
            expect(emitted).toMatchObject(expected);
        }
    });

    it("degrades z.any().refine(...) to the empty schema (the failure mode this file guards against)", () => {
        const opaque = z.any().refine(() => true);
        const { $schema, ...rest } = z.toJSONSchema(opaque, { unrepresentable: "any" });
        expect(rest).toEqual({});
    });

    it("keeps the array base for prefixItems tuples", () => {
        // Tuples are currently enforced by refinements on a plain array
        // base, so only the array type round-trips; the prefix structure
        // is pinned behaviorally instead.
        const schema = {
            type: "array",
            prefixItems: [{ type: "string" }, { type: "integer" }],
        };
        const converted = convertJsonSchemaToZod(schema as any);
        expect(converted).toBeInstanceOf(z.ZodArray);
        expect(roundTrip(schema)).toMatchObject({ type: "array" });
        expect(converted.safeParse(["a", 1]).success).toBe(true);
        expect(converted.safeParse([1, "a"]).success).toBe(false);
    });

    it("emits a plain union for a sibling-less anyOf", () => {
        // With no sibling constraints there is nothing for an intersection
        // base to add, so the converter returns the union directly (#63).
        expect(roundTrip({ anyOf: [{ type: "string" }, { type: "number" }] })).toEqual({
            anyOf: [{ type: "string" }, { type: "number" }],
        });
    });

    it("keeps the anyOf branch structure inside the combinator intersection", () => {
        // With sibling constraints, anyOf is combined with the base via
        // z.intersection, which emits allOf; the second member must keep
        // the branch types.
        expect(roundTrip({ type: "string", anyOf: [{ minLength: 1 }, { maxLength: 0 }] })).toMatchObject({
            allOf: [{ type: "string" }, expect.any(Object)],
        });
    });

    it("emits the target's structure for a bare $ref", () => {
        expect(
            roundTrip({
                $ref: "#/$defs/s",
                $defs: { s: { type: "string" } },
            }),
        ).toEqual({ type: "string" });
    });

    it("emits the target's structure for a bare $ref to an object", () => {
        expect(
            roundTrip({
                $ref: "#/$defs/person",
                $defs: {
                    person: {
                        type: "object",
                        properties: { name: { type: "string" } },
                        required: ["name"],
                    },
                },
            }),
        ).toMatchObject({
            type: "object",
            properties: { name: { type: "string" } },
            required: ["name"],
        });
    });

    it("emits the final target's structure for a chain of bare $refs", () => {
        expect(
            roundTrip({
                $ref: "#/$defs/a",
                $defs: {
                    a: { $ref: "#/$defs/b" },
                    b: { type: "number" },
                },
            }),
        ).toEqual({ type: "number" });
    });

    it("keeps the sibling type's structure alongside a $ref", () => {
        // The ref target is enforced by a refinement, so its bound is not
        // emitted, but the sibling type must keep its structure.
        expect(
            roundTrip({
                $ref: "#/$defs/atLeastZero",
                type: "number",
                $defs: { atLeastZero: { minimum: 0 } },
            }),
        ).toMatchObject({ type: "number" });
    });

    it("keeps the object structure of a recursive bare-ref target", () => {
        // The inner self-reference is a deferred refinement (emits {});
        // the outer object and array structure must survive.
        expect(
            roundTrip({
                $ref: "#/$defs/tree",
                $defs: {
                    tree: {
                        type: "object",
                        properties: {
                            children: {
                                type: "array",
                                items: { $ref: "#/$defs/tree" },
                            },
                        },
                    },
                },
            }),
        ).toMatchObject({
            type: "object",
            properties: { children: { type: "array" } },
        });
    });

    it("pins the ZodPipe emission for required properties with defaults", () => {
        // Required properties with defaults are handled (since #51) by a
        // raw-input presence check piping into the defaulting object
        // schema, i.e. a ZodPipe. z.toJSONSchema's default io ("output")
        // emits the structural output side; this is intentional.
        const schema = {
            type: "object",
            properties: { foo: { type: "string", default: "d" } },
            required: ["foo"],
        };
        const converted = convertJsonSchemaToZod(schema as any);
        expect(converted).toBeInstanceOf(z.ZodPipe);
        expect(roundTrip(schema)).toMatchObject({
            type: "object",
            properties: { foo: { type: "string", default: "d" } },
            required: ["foo"],
        });
    });

    it("emits the default for an optional defaulted schema", () => {
        const schema = { type: "string", default: "d" };
        const converted = convertJsonSchemaToZod(schema as any);
        expect(converted).toBeInstanceOf(z.ZodDefault);
        expect(roundTrip(schema)).toEqual({ type: "string", default: "d" });
    });
});

describe("strict z.toJSONSchema emission (#63, MCP SDK compatibility)", () => {
    // @modelcontextprotocol/sdk serializes registered tool schemas with
    // z.toJSONSchema(schema, { target: "draft-7", io: "input" }) — without
    // unrepresentable: "any" — so any z.custom(...) part in a converted
    // schema throws and fails the whole tools/list response.
    function strictSerialize(schema: unknown): Record<string, unknown> {
        const converted = convertJsonSchemaToZod(schema as any);
        const { $schema, ...rest } = z.toJSONSchema(converted, { target: "draft-7", io: "input" });
        return rest;
    }

    it("serializes a bare object schema", () => {
        const converted = convertJsonSchemaToZod({ type: "object" } as any);
        expect(strictSerialize({ type: "object" })).toMatchObject({ type: "object" });
        // The permissive object base must still reject arrays and non-objects.
        expect(converted.safeParse({ any: "keys", at: "all" }).success).toBe(true);
        expect(converted.safeParse({}).success).toBe(true);
        expect(converted.safeParse([1, 2]).success).toBe(false);
        expect(converted.safeParse("str").success).toBe(false);
        expect(converted.safeParse(null).success).toBe(false);
    });

    it("keeps unknown keys when parsing a bare object schema", () => {
        const converted = convertJsonSchemaToZod({ type: "object" } as any);
        expect(converted.parse({ a: 1, b: "two" })).toEqual({ a: 1, b: "two" });
    });

    it("serializes a sibling-less anyOf", () => {
        const schema = {
            anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
        };
        expect(strictSerialize(schema)).toEqual({
            anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
        });
        const converted = convertJsonSchemaToZod(schema as any);
        expect(converted.safeParse("one").success).toBe(true);
        expect(converted.safeParse(["a", "b"]).success).toBe(true);
        expect(converted.safeParse([1]).success).toBe(false);
        expect(converted.safeParse(42).success).toBe(false);
    });

    it("serializes a sibling-less anyOf with metadata keys", () => {
        expect(
            strictSerialize({
                title: "single or batch",
                description: "either form",
                anyOf: [{ type: "string" }, { type: "number" }],
            }),
        ).toMatchObject({ anyOf: [{ type: "string" }, { type: "number" }] });
    });

    it("serializes a type union that includes the permissive object base", () => {
        expect(strictSerialize({ type: ["object", "string"] })).toMatchObject({
            anyOf: [{ type: "string" }, { type: "object" }],
        });
    });

    it("still enforces sibling constraints alongside anyOf", () => {
        const schema = {
            type: "string",
            anyOf: [{ minLength: 3 }, { const: "a" }],
        };
        const converted = convertJsonSchemaToZod(schema as any);
        expect(converted.safeParse("abc").success).toBe(true);
        expect(converted.safeParse("a").success).toBe(true);
        expect(converted.safeParse("ab").success).toBe(false);
        expect(converted.safeParse(123).success).toBe(false);
    });

    it("still enforces $ref alongside a sibling-less anyOf", () => {
        const schema = {
            $ref: "#/$defs/short",
            anyOf: [{ type: "string" }, { type: "number" }],
            $defs: { short: { maxLength: 1 } },
        };
        const converted = convertJsonSchemaToZod(schema as any);
        expect(converted.safeParse("a").success).toBe(true);
        expect(converted.safeParse(7).success).toBe(true);
        expect(converted.safeParse("ab").success).toBe(false);
        expect(converted.safeParse(true).success).toBe(false);
    });
});
