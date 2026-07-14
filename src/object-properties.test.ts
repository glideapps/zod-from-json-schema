import { describe, it, expect } from "vitest";
import { convertJsonSchemaToZod } from "./core/converter";

describe("required is enforced for properties that have a default (issue #42)", () => {

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
