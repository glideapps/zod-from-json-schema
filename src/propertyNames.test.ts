import { describe, it, expect } from "vitest";
import { convertJsonSchemaToZod } from "./index";

describe("propertyNames", () => {
    it("should validate property names against a string constraint schema", () => {
        const schema = convertJsonSchemaToZod({ propertyNames: { maxLength: 3 } });

        expect(schema.safeParse({ f: {}, foo: {} }).success).toBe(true);
        expect(schema.safeParse({ foobar: {} }).success).toBe(false);
        expect(schema.safeParse({}).success).toBe(true);
    });

    it("should validate property names against a pattern", () => {
        const schema = convertJsonSchemaToZod({ propertyNames: { pattern: "^a+$" } });

        expect(schema.safeParse({ a: {}, aaa: {} }).success).toBe(true);
        expect(schema.safeParse({ aaA: {} }).success).toBe(false);
    });

    it("should reject all properties when propertyNames is false", () => {
        const schema = convertJsonSchemaToZod({ propertyNames: false });

        expect(schema.safeParse({}).success).toBe(true);
        expect(schema.safeParse({ foo: 1 }).success).toBe(false);
    });

    it("should accept any properties when propertyNames is true", () => {
        const schema = convertJsonSchemaToZod({ propertyNames: true });

        expect(schema.safeParse({ foo: 1, bar: 2 }).success).toBe(true);
    });

    it("should validate property names against a const", () => {
        const schema = convertJsonSchemaToZod({ propertyNames: { const: "foo" } });

        expect(schema.safeParse({ foo: 1 }).success).toBe(true);
        expect(schema.safeParse({ bar: 1 }).success).toBe(false);
    });

    it("should validate property names against an enum", () => {
        const schema = convertJsonSchemaToZod({ propertyNames: { enum: ["foo", "bar"] } });

        expect(schema.safeParse({ foo: 1, bar: 2 }).success).toBe(true);
        expect(schema.safeParse({ baz: 1 }).success).toBe(false);
    });

    it("should ignore non-object data", () => {
        const schema = convertJsonSchemaToZod({ propertyNames: { maxLength: 3 } });

        expect(schema.safeParse([1, 2, 3]).success).toBe(true);
        expect(schema.safeParse("foobar").success).toBe(true);
        expect(schema.safeParse(42).success).toBe(true);
        expect(schema.safeParse(null).success).toBe(true);
    });

    it("should combine with typed object schemas and other keywords", () => {
        const schema = convertJsonSchemaToZod({
            type: "object",
            properties: { ab: { type: "number" } },
            propertyNames: { maxLength: 2 },
        });

        expect(schema.safeParse({ ab: 1 }).success).toBe(true);
        expect(schema.safeParse({ ab: 1, cd: "x" }).success).toBe(true);
        expect(schema.safeParse({ abc: 1 }).success).toBe(false);
    });

    it("should leave schemas without propertyNames unchanged", () => {
        const schema = convertJsonSchemaToZod({ type: "object" });

        expect(schema.safeParse({ anything: "goes" }).success).toBe(true);
    });
});
