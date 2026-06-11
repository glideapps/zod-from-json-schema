import { describe, it, expect } from "vitest";
import { convertJsonSchemaToZod } from "./core/converter";

describe("required property presence", () => {
    it("enforces required keys that have no property schema", () => {
        const zodSchema = convertJsonSchemaToZod({ type: "object", required: ["foo"] } as any);
        expect(zodSchema.safeParse({}).success).toBe(false);
        expect(zodSchema.safeParse({ foo: 1 }).success).toBe(true);
        expect(zodSchema.safeParse({ foo: null }).success).toBe(true);
    });

    it("enforces required keys whose property schema accepts undefined", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { foo: {}, bar: {} },
            required: ["foo"],
        } as any);
        expect(zodSchema.safeParse({}).success).toBe(false);
        expect(zodSchema.safeParse({ bar: 1 }).success).toBe(false);
        expect(zodSchema.safeParse({ foo: "anything" }).success).toBe(true);
    });

    it("enforces required keys named like Object.prototype members", () => {
        const zodSchema = convertJsonSchemaToZod({ type: "object", required: ["toString"] } as any);
        expect(zodSchema.safeParse({}).success).toBe(false);
        expect(zodSchema.safeParse(JSON.parse('{"toString": "x"}')).success).toBe(true);
    });

    it("enforces required hazardous keys that also have a property schema", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { toString: { type: "string" } },
            required: ["toString"],
        } as any);
        expect(zodSchema.safeParse({}).success).toBe(false);
        expect(zodSchema.safeParse(JSON.parse('{"toString": "x"}')).success).toBe(true);
        expect(zodSchema.safeParse(JSON.parse('{"toString": 12}')).success).toBe(false);
    });

    it("cannot enforce presence of required __proto__ on typed objects", () => {
        // Zod strips own "__proto__" keys when building parse output, so
        // presence can't be checked there; the key is skipped rather than
        // making every object fail.
        const zodSchema = convertJsonSchemaToZod({ type: "object", required: ["__proto__"] } as any);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 12}')).success).toBe(true);
        expect(zodSchema.safeParse({}).success).toBe(true);
    });
});

describe("properties named like Object.prototype members", () => {
    it("treats inherited members as absent", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { toString: { type: "string" }, constructor: { type: "number" } },
        } as any);
        // {} inherits toString/constructor functions, but has no own keys.
        expect(zodSchema.safeParse({}).success).toBe(true);
    });

    it("validates own values against the property schema", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { toString: { type: "string" } },
        } as any);
        expect(zodSchema.safeParse(JSON.parse('{"toString": "x"}')).success).toBe(true);
        expect(zodSchema.safeParse(JSON.parse('{"toString": 12}')).success).toBe(false);
    });

    it("respects additionalProperties: false alongside hazardous property names", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { toString: { type: "string" }, plain: { type: "number" } },
            additionalProperties: false,
        } as any);
        expect(zodSchema.safeParse(JSON.parse('{"toString": "x", "plain": 1}')).success).toBe(true);
        expect(zodSchema.safeParse({ plain: 1, extra: true }).success).toBe(false);
    });

    it("validates extra keys against an additionalProperties schema alongside hazardous names", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { toString: { type: "string" } },
            additionalProperties: { type: "number" },
        } as any);
        expect(zodSchema.safeParse({ extra: 1 }).success).toBe(true);
        expect(zodSchema.safeParse({ extra: "nope" }).success).toBe(false);
    });
});

describe("patternProperties handled through refinement", () => {
    it("validates pattern-matched keys and rejects the rest under additionalProperties: false", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { declared: { type: "string" } },
            patternProperties: { "^x_": { type: "number" } },
            additionalProperties: false,
        } as any);
        expect(zodSchema.safeParse({ declared: "a", x_one: 1 }).success).toBe(true);
        expect(zodSchema.safeParse({ declared: "a", x_one: "nope" }).success).toBe(false);
        expect(zodSchema.safeParse({ declared: "a", other: 1 }).success).toBe(false);
    });

    it("checks non-matching keys against the additionalProperties schema", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { declared: { type: "string" } },
            patternProperties: { "^x_": { type: "number" } },
            additionalProperties: { type: "string" },
        } as any);
        expect(zodSchema.safeParse({ x_one: 1, other: "s" }).success).toBe(true);
        expect(zodSchema.safeParse({ other: 42 }).success).toBe(false);
    });

    it("ignores patterns that are not valid regular expressions", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { declared: { type: "string" } },
            patternProperties: { "[": { type: "number" } },
        } as any);
        expect(zodSchema.safeParse({ declared: "a", anything: "goes" }).success).toBe(true);
    });
});

describe("min/maxProperties combined with other keywords", () => {
    it("applies maxProperties when an explicit object type declares no properties", () => {
        const zodSchema = convertJsonSchemaToZod({ type: "object", maxProperties: 1 } as any);
        expect(zodSchema.safeParse({}).success).toBe(true);
        expect(zodSchema.safeParse({ a: 1 }).success).toBe(true);
        expect(zodSchema.safeParse({ a: 1, b: 2 }).success).toBe(false);
    });

    it("applies minProperties when an explicit object type declares no properties", () => {
        const zodSchema = convertJsonSchemaToZod({ type: "object", minProperties: 1 } as any);
        expect(zodSchema.safeParse({}).success).toBe(false);
        expect(zodSchema.safeParse({ a: 1 }).success).toBe(true);
    });

    it("ignores min/maxProperties when const excludes the object type", () => {
        const zodSchema = convertJsonSchemaToZod({ const: "x", minProperties: 1, maxProperties: 1 } as any);
        expect(zodSchema.safeParse("x").success).toBe(true);
        expect(zodSchema.safeParse("y").success).toBe(false);
    });
});

describe("oneOf combined with object constraints", () => {
    it("keeps oneOf refinements when the schema also declares properties", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { kind: { type: "string" } },
            oneOf: [{ properties: { kind: { const: "a" } } }, { properties: { kind: { const: "b" } } }],
        } as any);
        expect(zodSchema.safeParse({ kind: "a" }).success).toBe(true);
        expect(zodSchema.safeParse({ kind: "b" }).success).toBe(true);
        expect(zodSchema.safeParse({ kind: "c" }).success).toBe(false);
    });

    it("keeps anyOf and allOf refinements when the schema also declares properties", () => {
        const anyOfSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { n: { type: "number" } },
            anyOf: [{ properties: { n: { minimum: 10 } } }, { properties: { n: { maximum: 0 } } }],
        } as any);
        expect(anyOfSchema.safeParse({ n: 20 }).success).toBe(true);
        expect(anyOfSchema.safeParse({ n: -1 }).success).toBe(true);
        expect(anyOfSchema.safeParse({ n: 5 }).success).toBe(false);

        const allOfSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { n: { type: "number" } },
            allOf: [{ properties: { n: { minimum: 0 } } }, { properties: { n: { maximum: 10 } } }],
        } as any);
        expect(allOfSchema.safeParse({ n: 5 }).success).toBe(true);
        expect(allOfSchema.safeParse({ n: 20 }).success).toBe(false);
    });
});
