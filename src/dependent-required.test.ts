import { describe, expect, it } from "vitest";
import { convertJsonSchemaToZod } from "./index";

describe("dependentRequired keyword", () => {
    it("should be a no-op when dependentRequired is absent", () => {
        const schema = convertJsonSchemaToZod({ type: "object" });

        expect(schema.safeParse({ bar: 2 }).success).toBe(true);
    });

    it("should validate a single dependency", () => {
        const schema = convertJsonSchemaToZod({
            dependentRequired: { bar: ["foo"] },
        });

        expect(schema.safeParse({}).success).toBe(true);
        expect(schema.safeParse({ foo: 1 }).success).toBe(true);
        expect(schema.safeParse({ foo: 1, bar: 2 }).success).toBe(true);
        expect(schema.safeParse({ bar: 2 }).success).toBe(false);
    });

    it("should validate multiple dependents", () => {
        const schema = convertJsonSchemaToZod({
            dependentRequired: { quux: ["foo", "bar"] },
        });

        expect(schema.safeParse({ foo: 1, bar: 2, quux: 3 }).success).toBe(
            true,
        );
        expect(schema.safeParse({ foo: 1, quux: 3 }).success).toBe(false);
        expect(schema.safeParse({ bar: 2, quux: 3 }).success).toBe(false);
        expect(schema.safeParse({ quux: 3 }).success).toBe(false);
        expect(schema.safeParse({ foo: 1, bar: 2 }).success).toBe(true);
    });

    it("should validate multiple independent dependency entries", () => {
        const schema = convertJsonSchemaToZod({
            dependentRequired: { bar: ["foo"], baz: ["qux"] },
        });

        expect(schema.safeParse({ bar: 1, foo: 2 }).success).toBe(true);
        expect(schema.safeParse({ bar: 1, foo: 2, baz: 3 }).success).toBe(
            false,
        );
        expect(
            schema.safeParse({ bar: 1, foo: 2, baz: 3, qux: 4 }).success,
        ).toBe(true);
        expect(schema.safeParse({ baz: 3 }).success).toBe(false);
    });

    it("should handle escaped characters in dependency keys", () => {
        const schema = convertJsonSchemaToZod({
            dependentRequired: {
                "foo\nbar": ["foo\rbar"],
                'foo"bar': ["foo'bar"],
            },
        });

        expect(
            schema.safeParse({ "foo\nbar": 1, "foo\rbar": 2 }).success,
        ).toBe(true);
        expect(schema.safeParse({ "foo\nbar": 1, foo: 2 }).success).toBe(
            false,
        );
        expect(
            schema.safeParse({ 'foo"bar': 1, "foo'bar": 2 }).success,
        ).toBe(true);
        expect(schema.safeParse({ 'foo"bar': 2 }).success).toBe(false);
    });

    it("should ignore non-object data", () => {
        const schema = convertJsonSchemaToZod({
            dependentRequired: { bar: ["foo"] },
        });

        expect(schema.safeParse(["bar"]).success).toBe(true);
        expect(schema.safeParse("foobar").success).toBe(true);
        expect(schema.safeParse(12).success).toBe(true);
        expect(schema.safeParse(null).success).toBe(true);
        expect(schema.safeParse(true).success).toBe(true);
    });

    it("should always pass with empty dependents array", () => {
        const schema = convertJsonSchemaToZod({
            dependentRequired: { bar: [] },
        });

        expect(schema.safeParse({ bar: 2 }).success).toBe(true);
        expect(schema.safeParse({}).success).toBe(true);
    });

    it("should compose with explicit object type and properties", () => {
        const schema = convertJsonSchemaToZod({
            type: "object",
            properties: {
                foo: { type: "number" },
                bar: { type: "number" },
            },
            dependentRequired: { bar: ["foo"] },
        });

        expect(schema.safeParse({ foo: 1, bar: 2 }).success).toBe(true);
        expect(schema.safeParse({ bar: 2 }).success).toBe(false);
        expect(schema.safeParse({ bar: "nope", foo: 1 }).success).toBe(false);
        expect(schema.safeParse({}).success).toBe(true);
    });

    it("should compose with required", () => {
        const schema = convertJsonSchemaToZod({
            type: "object",
            properties: {
                foo: { type: "number" },
                bar: { type: "number" },
            },
            required: ["bar"],
            dependentRequired: { bar: ["foo"] },
        });

        expect(schema.safeParse({ foo: 1, bar: 2 }).success).toBe(true);
        expect(schema.safeParse({ bar: 2 }).success).toBe(false);
        expect(schema.safeParse({}).success).toBe(false);
    });
});
