import { describe, expect, it } from "vitest";
import { convertJsonSchemaToZod } from "./index";
import type { JSONSchema } from "zod/v4/core";

describe("if/then/else", () => {
    describe("if and then without else", () => {
        const schema: JSONSchema.BaseSchema = {
            if: { exclusiveMaximum: 0 },
            then: { minimum: -10 },
        };
        const zodSchema = convertJsonSchemaToZod(schema);

        it("accepts a value valid through then", () => {
            expect(zodSchema.safeParse(-1).success).toBe(true);
        });

        it("rejects a value invalid through then", () => {
            expect(zodSchema.safeParse(-100).success).toBe(false);
        });

        it("accepts a value when if does not match", () => {
            expect(zodSchema.safeParse(3).success).toBe(true);
        });
    });

    describe("if and else without then", () => {
        const schema: JSONSchema.BaseSchema = {
            if: { exclusiveMaximum: 0 },
            else: { multipleOf: 2 },
        };
        const zodSchema = convertJsonSchemaToZod(schema);

        it("accepts a value when if matches", () => {
            expect(zodSchema.safeParse(-1).success).toBe(true);
        });

        it("accepts a value valid through else", () => {
            expect(zodSchema.safeParse(4).success).toBe(true);
        });

        it("rejects a value invalid through else", () => {
            expect(zodSchema.safeParse(3).success).toBe(false);
        });
    });

    describe("if, then, and else together", () => {
        const schema: JSONSchema.BaseSchema = {
            if: { exclusiveMaximum: 0 },
            then: { minimum: -10 },
            else: { multipleOf: 2 },
        };
        const zodSchema = convertJsonSchemaToZod(schema);

        it("accepts a value valid through then", () => {
            expect(zodSchema.safeParse(-1).success).toBe(true);
        });

        it("rejects a value invalid through then", () => {
            expect(zodSchema.safeParse(-100).success).toBe(false);
        });

        it("accepts a value valid through else", () => {
            expect(zodSchema.safeParse(4).success).toBe(true);
        });

        it("rejects a value invalid through else", () => {
            expect(zodSchema.safeParse(3).success).toBe(false);
        });
    });

    describe("boolean schemas in if", () => {
        it("if: true always chooses the then path", () => {
            const zodSchema = convertJsonSchemaToZod({
                if: true,
                then: { const: "then" },
                else: { const: "else" },
            });
            expect(zodSchema.safeParse("then").success).toBe(true);
            expect(zodSchema.safeParse("else").success).toBe(false);
        });

        it("if: false always chooses the else path", () => {
            const zodSchema = convertJsonSchemaToZod({
                if: false,
                then: { const: "then" },
                else: { const: "else" },
            });
            expect(zodSchema.safeParse("else").success).toBe(true);
            expect(zodSchema.safeParse("then").success).toBe(false);
        });
    });

    describe("ignored keywords", () => {
        it("ignores a lone if without then or else", () => {
            const zodSchema = convertJsonSchemaToZod({
                if: { const: 0 },
            });
            expect(zodSchema.safeParse(0).success).toBe(true);
            expect(zodSchema.safeParse("hello").success).toBe(true);
        });

        it("ignores then and else without if", () => {
            const zodSchema = convertJsonSchemaToZod({
                then: { const: "then" },
                else: { const: "else" },
            });
            expect(zodSchema.safeParse("then").success).toBe(true);
            expect(zodSchema.safeParse("else").success).toBe(true);
            expect(zodSchema.safeParse(7).success).toBe(true);
        });
    });

    describe("keyword order independence", () => {
        const schema: JSONSchema.BaseSchema = {
            then: { const: "yes" },
            else: { const: "other" },
            if: { maxLength: 4 },
        };
        const zodSchema = convertJsonSchemaToZod(schema);

        it("redirects to then and passes", () => {
            expect(zodSchema.safeParse("yes").success).toBe(true);
        });

        it("redirects to then and fails", () => {
            expect(zodSchema.safeParse("no").success).toBe(false);
        });

        it("redirects to else and passes", () => {
            expect(zodSchema.safeParse("other").success).toBe(true);
        });

        it("redirects to else and fails", () => {
            expect(zodSchema.safeParse("invalid").success).toBe(false);
        });
    });

    describe("interaction with other keywords", () => {
        it("applies alongside a type constraint", () => {
            const zodSchema = convertJsonSchemaToZod({
                type: "integer",
                if: { minimum: 10 },
                then: { multipleOf: 5 },
            });
            expect(zodSchema.safeParse(15).success).toBe(true);
            expect(zodSchema.safeParse(12).success).toBe(false);
            expect(zodSchema.safeParse(3).success).toBe(true);
            expect(zodSchema.safeParse("15").success).toBe(false);
        });

        it("stays inert inside combined schemas without then/else", () => {
            const zodSchema = convertJsonSchemaToZod({
                allOf: [{ if: { exclusiveMaximum: 0 } }, { then: { minimum: -10 } }, { else: { multipleOf: 2 } }],
            });
            expect(zodSchema.safeParse(-100).success).toBe(true);
            expect(zodSchema.safeParse(3).success).toBe(true);
        });
    });
});
