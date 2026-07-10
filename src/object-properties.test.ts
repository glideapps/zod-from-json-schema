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

    it("enforces presence of required __proto__ on typed objects", () => {
        // Zod strips own "__proto__" keys when building parse output, so
        // presence is checked against the raw input by ProtoPropertyHandler.
        const zodSchema = convertJsonSchemaToZod({ type: "object", required: ["__proto__"] } as any);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 12}')).success).toBe(true);
        expect(zodSchema.safeParse({}).success).toBe(false);
    });
});

describe("required is enforced for properties that have a default (issue #42)", () => {
    it("rejects a missing required property even when it has a default", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { foo: { type: "string", default: "x" } },
            required: ["foo"],
        } as any);
        expect(zodSchema.safeParse({}).success).toBe(false);
    });

    it("keeps validating present values and does not overwrite them", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { foo: { type: "string", default: "x" } },
            required: ["foo"],
        } as any);
        const good = zodSchema.safeParse({ foo: "y" });
        expect(good.success).toBe(true);
        expect(good.data).toEqual({ foo: "y" });
        expect(zodSchema.safeParse({ foo: 5 }).success).toBe(false);
    });

    it("rejects non-object inputs through the piped object schema", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { foo: { type: "string", default: "x" } },
            required: ["foo"],
        } as any);
        expect(zodSchema.safeParse("hello").success).toBe(false);
        expect(zodSchema.safeParse(null).success).toBe(false);
        expect(zodSchema.safeParse([]).success).toBe(false);
        expect(zodSchema.safeParse(42).success).toBe(false);
    });

    it("works together with additionalProperties: false", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { foo: { type: "string", default: "x" } },
            required: ["foo"],
            additionalProperties: false,
        } as any);
        expect(zodSchema.safeParse({}).success).toBe(false);
        expect(zodSchema.safeParse({ foo: "y", extra: 1 }).success).toBe(false);
        expect(zodSchema.safeParse({ foo: "y" }).success).toBe(true);
    });

    it("enforces required-with-default when no explicit type is given", () => {
        const zodSchema = convertJsonSchemaToZod({
            properties: { foo: { type: "string", default: "x" } },
            required: ["foo"],
        } as any);
        expect(zodSchema.safeParse({}).success).toBe(false);
        expect(zodSchema.safeParse({ foo: "y" }).success).toBe(true);
        // JSON Schema: required only constrains objects.
        expect(zodSchema.safeParse("not an object").success).toBe(true);
    });

    it("enforces required-with-default in nested objects", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: {
                cfg: {
                    type: "object",
                    properties: { mode: { type: "string", default: "auto" } },
                    required: ["mode"],
                },
            },
            required: ["cfg"],
        } as any);
        expect(zodSchema.safeParse({ cfg: {} }).success).toBe(false);
        expect(zodSchema.safeParse({}).success).toBe(false);
        expect(zodSchema.safeParse({ cfg: { mode: "m" } }).success).toBe(true);
    });

    it("keeps applying defaults for non-required missing properties", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: {
                foo: { type: "string", default: "x" },
                bar: { type: "number", default: 1 },
            },
            required: ["foo"],
        } as any);
        const result = zodSchema.safeParse({ foo: "y" });
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ foo: "y", bar: 1 });
    });

    it("enforces required-with-default for hazardous property names", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { toString: { type: "string", default: "x" } },
            required: ["toString"],
        } as any);
        expect(zodSchema.safeParse({}).success).toBe(false);
        expect(zodSchema.safeParse(JSON.parse('{"toString": "y"}')).success).toBe(true);
    });

    it("still applies a top-level default on an optional nested object", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: {
                cfg: {
                    type: "object",
                    properties: { mode: { type: "string" } },
                    required: ["mode"],
                    default: { mode: "auto" },
                },
            },
        } as any);
        const result = zodSchema.safeParse({});
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ cfg: { mode: "auto" } });
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

    it("validates __proto__ values on typed objects", () => {
        // Zod strips own "__proto__" keys when building parse output, so the
        // __proto__ property schema is enforced against the raw input by
        // ProtoPropertyHandler before Zod's object parsing runs.
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { ["__proto__"]: { type: "number" } },
        } as any);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 12}')).success).toBe(true);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": "bad"}')).success).toBe(false);
        expect(zodSchema.safeParse({}).success).toBe(true);
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

describe("patternProperties without properties, required, or additionalProperties: false (issue #39)", () => {
    it("enforces patternProperties as the only object keyword", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            patternProperties: { "^x_": { type: "number" } },
        } as any);
        expect(zodSchema.safeParse({ x_bad: "no" }).success).toBe(false);
        expect(zodSchema.safeParse({ x_ok: 1 }).success).toBe(true);
        // Non-matching keys are unconstrained since additionalProperties is absent.
        expect(zodSchema.safeParse({ other: "anything" }).success).toBe(true);
    });

    it("checks non-matching keys against a sibling additionalProperties schema", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            patternProperties: { "^x_": { type: "number" } },
            additionalProperties: { type: "number" },
        } as any);
        expect(zodSchema.safeParse({ other: "no" }).success).toBe(false);
        expect(zodSchema.safeParse({ x_a: "s" }).success).toBe(false);
        expect(zodSchema.safeParse({ other: 3 }).success).toBe(true);
        expect(zodSchema.safeParse({ x_a: 1 }).success).toBe(true);
    });

    it("applies patternProperties on untyped schemas and passes non-objects through", () => {
        const zodSchema = convertJsonSchemaToZod({
            patternProperties: { "^x_": { type: "number" } },
        } as any);
        expect(zodSchema.safeParse({ x_bad: "no" }).success).toBe(false);
        expect(zodSchema.safeParse({ x_ok: 1 }).success).toBe(true);
        expect(zodSchema.safeParse("str").success).toBe(true);
        expect(zodSchema.safeParse(42).success).toBe(true);
    });

    it("supports boolean pattern schemas", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            patternProperties: { "f.*": true, "b.*": false },
        } as any);
        expect(zodSchema.safeParse({ foo: 1 }).success).toBe(true);
        expect(zodSchema.safeParse({ bar: 2 }).success).toBe(false);
    });

    it("keeps enforcing an additionalProperties schema alone via the object shape", () => {
        const typedSchema = convertJsonSchemaToZod({
            type: "object",
            additionalProperties: { type: "number" },
        } as any);
        expect(typedSchema.safeParse({ a: "no" }).success).toBe(false);
        expect(typedSchema.safeParse({ a: 2 }).success).toBe(true);

        const untypedSchema = convertJsonSchemaToZod({
            additionalProperties: { type: "number" },
        } as any);
        expect(untypedSchema.safeParse({ a: "no" }).success).toBe(false);
        expect(untypedSchema.safeParse({ a: 2 }).success).toBe(true);
    });

    it("treats empty patternProperties as no constraint", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            patternProperties: {},
        } as any);
        expect(zodSchema.safeParse({ anything: "goes" }).success).toBe(true);
    });
});

describe("additionalProperties: false on typed objects", () => {
    it("rejects objects with extra keys instead of stripping them", () => {
        // Before the oneOf fix, typed object schemas with
        // additionalProperties: false parsed successfully and silently
        // stripped unknown keys. JSON Schema requires validation to fail,
        // which is also how the same schema without `type: "object"` already
        // behaved.
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { name: { type: "string" } },
            additionalProperties: false,
        } as any);
        expect(zodSchema.safeParse({ name: "a" }).success).toBe(true);
        expect(zodSchema.safeParse({ name: "a", extra: 1 }).success).toBe(false);

        const untypedSchema = convertJsonSchemaToZod({
            properties: { name: { type: "string" } },
            additionalProperties: false,
        } as any);
        expect(untypedSchema.safeParse({ name: "a", extra: 1 }).success).toBe(false);
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

describe("keys declared in properties also validate against patternProperties (issue #40)", () => {
    it("rejects a declared property that violates a matching pattern schema", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { foo: { type: "string" } },
            patternProperties: { "^foo$": { minLength: 2 } },
        } as any);
        expect(zodSchema.safeParse({ foo: "a" }).success).toBe(false);
        expect(zodSchema.safeParse({ foo: "ab" }).success).toBe(true);
    });

    it("still rejects a declared property that violates its own property schema", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { foo: { type: "string" } },
            patternProperties: { "^foo$": { minLength: 2 } },
        } as any);
        expect(zodSchema.safeParse({ foo: 42 }).success).toBe(false);
    });

    it("requires a declared property to satisfy every matching pattern schema", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { foo: { type: "string" } },
            patternProperties: { "^f": { minLength: 2 }, "oo$": { maxLength: 3 } },
        } as any);
        expect(zodSchema.safeParse({ foo: "ab" }).success).toBe(true);
        expect(zodSchema.safeParse({ foo: "a" }).success).toBe(false);
        expect(zodSchema.safeParse({ foo: "abcd" }).success).toBe(false);
    });

    it("does not apply non-matching pattern schemas to declared properties", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { bar: { type: "string" } },
            patternProperties: { "^foo$": { type: "number" } },
        } as any);
        expect(zodSchema.safeParse({ bar: "hello" }).success).toBe(true);
    });

    it("treats pattern-matching declared keys as evaluated under additionalProperties: false", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { foo: { type: "string" } },
            patternProperties: { "^foo$": { minLength: 2 } },
            additionalProperties: false,
        } as any);
        expect(zodSchema.safeParse({ foo: "ab" }).success).toBe(true);
        expect(zodSchema.safeParse({ foo: "a" }).success).toBe(false);
        expect(zodSchema.safeParse({ foo: "ab", other: 1 }).success).toBe(false);
    });

    it("does not run the additionalProperties schema on declared keys that match a pattern", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { foo: { type: "string" } },
            patternProperties: { "^foo$": { minLength: 2 } },
            additionalProperties: { type: "number" },
        } as any);
        expect(zodSchema.safeParse({ foo: "ab", other: 5 }).success).toBe(true);
        expect(zodSchema.safeParse({ foo: "ab", other: "nope" }).success).toBe(false);
    });

    it("validates declared pattern-matching keys on untyped schemas too", () => {
        const zodSchema = convertJsonSchemaToZod({
            properties: { foo: { type: "array", maxItems: 3 } },
            patternProperties: { "f.o": { minItems: 2 } },
            additionalProperties: { type: "integer" },
        } as any);
        expect(zodSchema.safeParse({ foo: [] }).success).toBe(false);
        expect(zodSchema.safeParse({ foo: [1, 2] }).success).toBe(true);
    });
});
