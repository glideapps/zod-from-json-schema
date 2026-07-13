import { describe, expect, it } from "vitest";
import { convertJsonSchemaToZod } from "./index";

describe("dependentSchemas keyword", () => {
    it("should apply the dependent schema when the trigger key is present", () => {
        const schema = convertJsonSchemaToZod({
            dependentSchemas: {
                bar: {
                    properties: {
                        foo: { type: "integer" },
                        bar: { type: "integer" },
                    },
                },
            },
        });

        expect(schema.safeParse({ foo: 1, bar: 2 }).success).toBe(true);
        expect(schema.safeParse({ foo: "quux" }).success).toBe(true);
        expect(schema.safeParse({ foo: "quux", bar: 2 }).success).toBe(false);
        expect(schema.safeParse({ foo: 2, bar: "quux" }).success).toBe(false);
        expect(schema.safeParse({ foo: "quux", bar: "quux" }).success).toBe(false);
    });

    it("should ignore non-object values", () => {
        const schema = convertJsonSchemaToZod({
            dependentSchemas: {
                bar: { required: ["foo"] },
            },
        });

        expect(schema.safeParse(["bar"]).success).toBe(true);
        expect(schema.safeParse("foobar").success).toBe(true);
        expect(schema.safeParse(12).success).toBe(true);
        expect(schema.safeParse(null).success).toBe(true);
        expect(schema.safeParse(true).success).toBe(true);
    });

    it("should handle boolean subschemas", () => {
        const schema = convertJsonSchemaToZod({
            dependentSchemas: {
                foo: true,
                bar: false,
            },
        });

        expect(schema.safeParse({ foo: 1 }).success).toBe(true);
        expect(schema.safeParse({ bar: 2 }).success).toBe(false);
        expect(schema.safeParse({ foo: 1, bar: 2 }).success).toBe(false);
        expect(schema.safeParse({ baz: 1 }).success).toBe(true);
        expect(schema.safeParse({}).success).toBe(true);
    });

    it("should handle dependency keys with escaped characters", () => {
        const schema = convertJsonSchemaToZod({
            dependentSchemas: {
                'foo\tbar': { minProperties: 4 },
                "foo'bar": { required: ['foo"bar'] },
            },
        });

        expect(
            schema.safeParse({ "foo\tbar": 1, a: 2, b: 3, c: 4 }).success,
        ).toBe(true);
        expect(schema.safeParse({ "foo'bar": 1 }).success).toBe(false);
        expect(schema.safeParse({ "foo\tbar": 1, a: 2 }).success).toBe(false);
        expect(schema.safeParse({ 'foo"bar': 2 }).success).toBe(true);
    });

    it("should enforce dependent subschemas incompatible with the root", () => {
        const schema = convertJsonSchemaToZod({
            properties: {
                foo: {},
            },
            dependentSchemas: {
                foo: {
                    properties: {
                        bar: {},
                    },
                    additionalProperties: false,
                },
            },
        });

        expect(schema.safeParse({ bar: 1 }).success).toBe(true);
        expect(schema.safeParse({ foo: 1 }).success).toBe(false);
        expect(schema.safeParse({ foo: 1, bar: 2 }).success).toBe(false);
    });

    it("should combine with an explicit object type", () => {
        const schema = convertJsonSchemaToZod({
            type: "object",
            properties: {
                credit_card: { type: "number" },
            },
            dependentSchemas: {
                credit_card: {
                    required: ["billing_address"],
                },
            },
        });

        expect(schema.safeParse({ credit_card: 123 }).success).toBe(false);
        expect(
            schema.safeParse({ credit_card: 123, billing_address: "x" })
                .success,
        ).toBe(true);
        expect(schema.safeParse({ name: "John" }).success).toBe(true);
        expect(schema.safeParse("not an object").success).toBe(false);
    });

    it("should use own-property semantics for hazardous keys", () => {
        // Build via JSON.parse so "__proto__" is an own key of the
        // dependentSchemas map (an object literal would set the prototype).
        const schema = convertJsonSchemaToZod(
            JSON.parse(
                '{"dependentSchemas": {' +
                    '"__proto__": {"required": ["foo"]},' +
                    '"toString": {"required": ["bar"]}}}',
            ),
        );

        // Plain objects inherit __proto__/toString but do not own them
        expect(schema.safeParse({ foo: 1 }).success).toBe(true);
        expect(schema.safeParse({}).success).toBe(true);
        expect(schema.safeParse({ toString: 1, bar: 2 }).success).toBe(true);
        expect(schema.safeParse({ toString: 1 }).success).toBe(false);
        const withProto = JSON.parse('{"__proto__": 1}');
        expect(schema.safeParse(withProto).success).toBe(false);
        const withProtoAndFoo = JSON.parse('{"__proto__": 1, "foo": 2}');
        expect(schema.safeParse(withProtoAndFoo).success).toBe(true);
    });

    it("should ignore an empty dependentSchemas object", () => {
        const schema = convertJsonSchemaToZod({
            dependentSchemas: {},
        });

        expect(schema.safeParse({ foo: 1 }).success).toBe(true);
        expect(schema.safeParse("anything").success).toBe(true);
    });

    it("should ignore entries whose subschema is undefined", () => {
        const schema = convertJsonSchemaToZod({
            dependentSchemas: {
                foo: undefined,
            },
        } as any);

        expect(schema.safeParse({ foo: 1 }).success).toBe(true);
    });

    it("should ignore a non-object dependentSchemas value", () => {
        const schema = convertJsonSchemaToZod({
            dependentSchemas: null,
        } as any);

        expect(schema.safeParse({ foo: 1 }).success).toBe(true);
    });
});
