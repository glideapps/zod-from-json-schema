import { describe, it, expect } from "vitest";
import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { convertJsonSchemaToZod } from "./index";

// Regression tests for issue #45: the JSON Schema draft-4 boolean form of
// exclusiveMinimum/exclusiveMaximum must never disable the number type.
// exclusiveMinimum: true with a numeric sibling `minimum` makes the bound
// exclusive; exclusiveMinimum: false (or a boolean without a numeric
// sibling bound) is a no-op. Mirror semantics for exclusiveMaximum.
describe("Draft-4 boolean exclusiveMinimum/exclusiveMaximum (issue #45)", () => {
    it("treats exclusiveMinimum: true with minimum as an exclusive lower bound", () => {
        const schema = convertJsonSchemaToZod({
            type: "number",
            minimum: 5,
            exclusiveMinimum: true,
        });

        expect(schema.safeParse(10).success).toBe(true);
        expect(schema.safeParse(6).success).toBe(true);
        expect(schema.safeParse(5).success).toBe(false);
        expect(schema.safeParse(4).success).toBe(false);
        expect(schema.safeParse("6").success).toBe(false);
    });

    it("treats exclusiveMaximum: true with maximum as an exclusive upper bound", () => {
        const schema = convertJsonSchemaToZod({
            type: "number",
            maximum: 5,
            exclusiveMaximum: true,
        });

        expect(schema.safeParse(4).success).toBe(true);
        expect(schema.safeParse(5).success).toBe(false);
        expect(schema.safeParse(6).success).toBe(false);
    });

    it("treats exclusiveMinimum: false as a no-op (minimum stays inclusive)", () => {
        const schema = convertJsonSchemaToZod({
            type: "number",
            minimum: 5,
            exclusiveMinimum: false,
        });

        expect(schema.safeParse(5).success).toBe(true);
        expect(schema.safeParse(6).success).toBe(true);
        expect(schema.safeParse(4).success).toBe(false);
    });

    it("treats exclusiveMaximum: false as a no-op (maximum stays inclusive)", () => {
        const schema = convertJsonSchemaToZod({
            type: "number",
            maximum: 5,
            exclusiveMaximum: false,
        });

        expect(schema.safeParse(5).success).toBe(true);
        expect(schema.safeParse(4).success).toBe(true);
        expect(schema.safeParse(6).success).toBe(false);
    });

    it("never disables number for exclusiveMinimum: true without a minimum", () => {
        const schema = convertJsonSchemaToZod({
            type: "number",
            exclusiveMinimum: true,
        });

        expect(schema.safeParse(0).success).toBe(true);
        expect(schema.safeParse(-100).success).toBe(true);
    });

    it("never disables number for exclusiveMaximum: true without a maximum", () => {
        const schema = convertJsonSchemaToZod({
            type: "number",
            exclusiveMaximum: true,
        });

        expect(schema.safeParse(0).success).toBe(true);
        expect(schema.safeParse(100).success).toBe(true);
    });

    it("supports a combined draft-4 exclusive range", () => {
        const schema = convertJsonSchemaToZod({
            type: "number",
            minimum: 0,
            maximum: 10,
            exclusiveMinimum: true,
            exclusiveMaximum: true,
        });

        expect(schema.safeParse(0).success).toBe(false);
        expect(schema.safeParse(10).success).toBe(false);
        expect(schema.safeParse(0.5).success).toBe(true);
        expect(schema.safeParse(5).success).toBe(true);
        expect(schema.safeParse(-1).success).toBe(false);
        expect(schema.safeParse(11).success).toBe(false);
    });

    it("applies the boolean form to integer schemas", () => {
        const schema = convertJsonSchemaToZod({
            type: "integer",
            minimum: 5,
            exclusiveMinimum: true,
        });

        expect(schema.safeParse(6).success).toBe(true);
        expect(schema.safeParse(5).success).toBe(false);
        expect(schema.safeParse(5.5).success).toBe(false);
    });

    it("keeps numeric exclusiveMinimum/exclusiveMaximum behavior unchanged", () => {
        const schema = convertJsonSchemaToZod({
            type: "number",
            exclusiveMinimum: 0,
            exclusiveMaximum: 100,
        });

        expect(schema.safeParse(0).success).toBe(false);
        expect(schema.safeParse(1).success).toBe(true);
        expect(schema.safeParse(100).success).toBe(false);
        expect(schema.safeParse(99).success).toBe(true);
    });

    it("does not disable number for exclusiveMaximum: true with a non-numeric sibling maximum", () => {
        const malformed = {
            type: "number",
            exclusiveMaximum: true,
            maximum: "x",
        } as unknown as JSONSchema.BaseSchema;
        const schema = convertJsonSchemaToZod(malformed);

        // The malformed `maximum: "x"` check itself rejects the value
        // (pre-existing MaximumHandler behavior), but the number type
        // must no longer be dropped to `never` by the boolean
        // exclusiveMaximum.
        const result = schema.safeParse(7);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.code).toBe("too_big");
    });
});
