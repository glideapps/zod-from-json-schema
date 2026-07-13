import { describe, it, expect } from "vitest";
import { convertJsonSchemaToZod } from "./core/converter";

// Validation involving an own "__proto__" key must run on the RAW input:
// Zod strips own "__proto__" keys from its parse output as a
// prototype-pollution defense, so refinements running on that output never
// see the key. ProtoPropertyHandler wraps the converted schema so the check
// happens before Zod's object parsing. Inputs are built via JSON.parse or
// computed keys, and read back with Object.prototype.hasOwnProperty.call —
// never through obj.__proto__.
describe("__proto__ property validation on raw input", () => {
    it("keeps enforcing required __proto__ on untyped schemas", () => {
        const zodSchema = convertJsonSchemaToZod({ required: ["__proto__"] } as any);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1}')).success).toBe(true);
        expect(zodSchema.safeParse({}).success).toBe(false);
        // Non-objects are not constrained by object keywords.
        expect(zodSchema.safeParse("hi").success).toBe(true);
        expect(zodSchema.safeParse(null).success).toBe(true);
        expect(zodSchema.safeParse([1]).success).toBe(true);
    });

    it("validates a __proto__ property schema on untyped schemas", () => {
        const zodSchema = convertJsonSchemaToZod({
            properties: { ["__proto__"]: { type: "number" } },
        } as any);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": "bad"}')).success).toBe(false);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 3}')).success).toBe(true);
        expect(zodSchema.safeParse(12).success).toBe(true);
        expect(zodSchema.safeParse(null).success).toBe(true);
    });

    it("combines required __proto__ with a __proto__ property schema", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { ["__proto__"]: { type: "number" } },
            required: ["__proto__"],
        } as any);
        expect(zodSchema.safeParse({}).success).toBe(false);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": "bad"}')).success).toBe(false);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 5}')).success).toBe(true);
    });

    it("enforces required __proto__ alongside ordinary required keys", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { x: { type: "number" } },
            required: ["__proto__", "x"],
        } as any);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1, "x": 2}')).success).toBe(true);
        expect(zodSchema.safeParse(JSON.parse('{"x": 2}')).success).toBe(false);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1}')).success).toBe(false);
    });

    it("reads a __proto__ property schema safely off a JSON.parse'd schema", () => {
        const schema = JSON.parse(
            '{"type":"object","properties":{"__proto__":{"type":"string"},"x":{"type":"number"}}}',
        );
        const zodSchema = convertJsonSchemaToZod(schema);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__":"ok","x":1}')).success).toBe(true);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__":5,"x":1}')).success).toBe(false);
        expect(zodSchema.safeParse(JSON.parse('{"x":"bad"}')).success).toBe(false);
    });

    it("still strips own __proto__ keys from parse output (pollution defense)", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { ["__proto__"]: { type: "number" } },
        } as any);
        const result = zodSchema.safeParse(JSON.parse('{"__proto__": 12, "x": 1}'));
        expect(result.success).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(result.data, "__proto__")).toBe(false);
        expect(Object.getPrototypeOf(result.data)).toBe(Object.prototype);
    });

    it("ignores a __proto__ property entry whose schema is undefined", () => {
        const zodSchema = convertJsonSchemaToZod({
            properties: { ["__proto__"]: undefined },
        } as any);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": "anything"}')).success).toBe(true);
    });

    it("supports a boolean false schema for __proto__", () => {
        const zodSchema = convertJsonSchemaToZod({
            properties: { ["__proto__"]: false },
        } as any);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1}')).success).toBe(false);
        expect(zodSchema.safeParse({}).success).toBe(true);
    });

    it("treats a boolean true schema for __proto__ as unconstrained", () => {
        const zodSchema = convertJsonSchemaToZod({
            properties: { ["__proto__"]: true },
        } as any);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": "anything"}')).success).toBe(true);
        expect(zodSchema.safeParse({}).success).toBe(true);
    });

    it("keeps a declared __proto__ property exempt from additionalProperties: false", () => {
        const zodSchema = convertJsonSchemaToZod(
            JSON.parse(
                '{"type":"object","properties":{"__proto__":{"type":"number"},"a":{"type":"string"}},"additionalProperties":false}',
            ),
        );
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1, "a": "x"}')).success).toBe(true);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 2}')).success).toBe(true);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": "bad"}')).success).toBe(false);
        expect(zodSchema.safeParse(JSON.parse('{"b": 1}')).success).toBe(false);
    });

    it("does not reject non-objects when __proto__ is required on another type", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "string",
            required: ["__proto__"],
        } as any);
        expect(zodSchema.safeParse("hi").success).toBe(true);
    });
});

// Refinements that inspect the parsed value (complex enum/const deep
// equality, minProperties/maxProperties counting) would otherwise run on
// Zod's __proto__-stripped output. When a schema constrains "__proto__",
// they must run on the raw input instead, so inputs that are valid per
// JSON Schema keep being accepted.
describe("__proto__ combined with value-inspecting keywords", () => {
    it("matches enum members that carry an own __proto__ key", () => {
        const zodSchema = convertJsonSchemaToZod({
            required: ["__proto__"],
            enum: [JSON.parse('{"__proto__": 1}'), "a"],
        } as any);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1}')).success).toBe(true);
        expect(zodSchema.safeParse("a").success).toBe(true);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 2}')).success).toBe(false);
        expect(zodSchema.safeParse("b").success).toBe(false);
        expect(zodSchema.safeParse({}).success).toBe(false);
    });

    it("matches enum members when __proto__ has a property schema", () => {
        const zodSchema = convertJsonSchemaToZod({
            properties: { ["__proto__"]: { type: "number" } },
            enum: [JSON.parse('{"__proto__": 1}')],
        } as any);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1}')).success).toBe(true);
        // Passes the property schema but is not an enum member.
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 2}')).success).toBe(false);
    });

    it("keeps the empty-enum special cases when __proto__ is constrained", () => {
        // enum: [] without a type rejects everything; with a type it acts as
        // no enum constraint. Own "__proto__" keys can't change either, so
        // the __proto__ checks compose with the usual empty-enum handling.
        const untyped = convertJsonSchemaToZod({ required: ["__proto__"], enum: [] } as any);
        expect(untyped.safeParse(JSON.parse('{"__proto__": 1}')).success).toBe(false);

        const typed = convertJsonSchemaToZod({
            type: "object",
            required: ["__proto__"],
            enum: [],
        } as any);
        expect(typed.safeParse(JSON.parse('{"__proto__": 1}')).success).toBe(true);
        expect(typed.safeParse({}).success).toBe(false);
    });

    it("matches a const value that carries an own __proto__ key", () => {
        const zodSchema = convertJsonSchemaToZod({
            required: ["__proto__"],
            const: JSON.parse('{"__proto__": 1}'),
        } as any);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1}')).success).toBe(true);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 2}')).success).toBe(false);
        expect(zodSchema.safeParse("x").success).toBe(false);
    });

    it("counts own __proto__ keys for minProperties on untyped schemas", () => {
        const one = convertJsonSchemaToZod({
            required: ["__proto__"],
            minProperties: 1,
        } as any);
        expect(one.safeParse(JSON.parse('{"__proto__": 1}')).success).toBe(true);
        // Object keywords do not constrain non-objects.
        expect(one.safeParse("hi").success).toBe(true);

        const two = convertJsonSchemaToZod({
            required: ["__proto__"],
            minProperties: 2,
        } as any);
        expect(two.safeParse(JSON.parse('{"__proto__": 1, "x": 2}')).success).toBe(true);
        expect(two.safeParse(JSON.parse('{"__proto__": 1}')).success).toBe(false);
    });

    it("counts own __proto__ keys for maxProperties on untyped schemas", () => {
        const zodSchema = convertJsonSchemaToZod({
            required: ["__proto__"],
            maxProperties: 1,
        } as any);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1}')).success).toBe(true);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1, "x": 2}')).success).toBe(false);
        expect(zodSchema.safeParse("hi").success).toBe(true);
    });

    it("counts own __proto__ keys for minProperties on typed object schemas", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            required: ["__proto__"],
            minProperties: 1,
        } as any);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1}')).success).toBe(true);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1, "x": 2}')).success).toBe(true);
    });
});

describe("__proto__ combined with required properties that have defaults", () => {
    // PropertiesHandler pipes a raw-input required check in front of the
    // object schema, and ProtoPropertyHandler pipes its raw __proto__ check
    // in front of everything. These tests pin down that the nested pipes
    // cooperate.
    it("enforces both a required-with-default property and a __proto__ value schema", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: {
                foo: { type: "string", default: "x" },
                ["__proto__"]: { type: "number" },
            },
            required: ["foo"],
        } as any);

        expect(zodSchema.safeParse({}).success).toBe(false);
        expect(zodSchema.safeParse(JSON.parse('{"foo": "y", "__proto__": "bad"}')).success).toBe(false);
        expect(zodSchema.safeParse(JSON.parse('{"foo": "y", "__proto__": 3}')).success).toBe(true);
    });

    it("enforces required __proto__ alongside a required-with-default property", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            required: ["__proto__", "foo"],
            properties: {
                foo: { type: "string", default: "x" },
            },
        } as any);

        expect(zodSchema.safeParse({}).success).toBe(false);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1}')).success).toBe(false);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1, "foo": "y"}')).success).toBe(true);
    });
});

describe("__proto__ combined with references", () => {
    it("preserves a sibling $ref constraint", () => {
        const zodSchema = convertJsonSchemaToZod({
            type: "object",
            properties: { ["__proto__"]: { type: "number" } },
            $ref: "#/$defs/needsFoo",
            $defs: {
                needsFoo: {
                    type: "object",
                    properties: {
                        foo: { type: "number" },
                        ["__proto__"]: { type: "number" },
                    },
                    required: ["foo", "__proto__"],
                },
            },
        } as any);

        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1, "foo": 2}')).success).toBe(true);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1}')).success).toBe(false);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1, "foo": "bad"}')).success).toBe(false);
    });

    it("keeps ignoring a no-progress self-reference", () => {
        const zodSchema = convertJsonSchemaToZod({
            required: ["__proto__"],
            $ref: "#",
        } as any);

        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1}')).success).toBe(true);
        expect(zodSchema.safeParse({}).success).toBe(false);
    });
});

describe("__proto__ combined with other object keywords", () => {
    it("applies propertyNames to an own __proto__ key", () => {
        const zodSchema = convertJsonSchemaToZod({
            properties: { ["__proto__"]: { type: "number" } },
            propertyNames: { not: { const: "__proto__" } },
        } as any);

        expect(zodSchema.safeParse(JSON.parse('{"ok": 1}')).success).toBe(true);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1}')).success).toBe(false);
    });

    it("uses an own __proto__ key as a dependentRequired trigger", () => {
        const zodSchema = convertJsonSchemaToZod({
            properties: { ["__proto__"]: { type: "number" } },
            dependentRequired: { ["__proto__"]: ["foo"] },
        } as any);

        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1, "foo": 2}')).success).toBe(true);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1}')).success).toBe(false);
    });

    it("allows an own __proto__ key to satisfy dependentRequired", () => {
        const zodSchema = convertJsonSchemaToZod({
            properties: { ["__proto__"]: { type: "number" } },
            dependentRequired: { foo: ["__proto__"] },
        } as any);

        expect(zodSchema.safeParse(JSON.parse('{"foo": 2, "__proto__": 1}')).success).toBe(true);
        expect(zodSchema.safeParse(JSON.parse('{"foo": 2}')).success).toBe(false);
    });

    it("uses an own __proto__ key as a dependentSchemas trigger", () => {
        const zodSchema = convertJsonSchemaToZod({
            properties: { ["__proto__"]: { type: "number" } },
            dependentSchemas: { ["__proto__"]: { required: ["foo"] } },
        } as any);

        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1, "foo": 2}')).success).toBe(true);
        expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1}')).success).toBe(false);
    });
});
