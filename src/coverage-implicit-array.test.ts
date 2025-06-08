import { describe, it, expect } from "vitest";
import { convertJsonSchemaToZod } from "./index";

describe("ImplicitArrayHandler Coverage", () => {
    it("should cover minItems constraint without explicit type", () => {
        const schema = { minItems: 1 };
        const zodSchema = convertJsonSchemaToZod(schema);
        
        // Should enable array type implicitly
        expect(zodSchema.safeParse([1, 2]).success).toBe(true);
        expect(zodSchema.safeParse([]).success).toBe(false);
        expect(zodSchema.safeParse("string").success).toBe(true);
    });

    it("should cover maxItems constraint without explicit type", () => {
        const schema = { maxItems: 2 };
        const zodSchema = convertJsonSchemaToZod(schema);
        
        // Should enable array type implicitly
        expect(zodSchema.safeParse([1]).success).toBe(true);
        expect(zodSchema.safeParse([1, 2]).success).toBe(true);
        expect(zodSchema.safeParse([1, 2, 3]).success).toBe(false);
        expect(zodSchema.safeParse("string").success).toBe(true);
    });

    it("should cover items constraint without explicit type", () => {
        const schema = { items: { type: "string" } };
        const zodSchema = convertJsonSchemaToZod(schema);
        
        // Should enable array type implicitly
        expect(zodSchema.safeParse(["a", "b"]).success).toBe(true);
        expect(zodSchema.safeParse([1, 2]).success).toBe(false);
        expect(zodSchema.safeParse("string").success).toBe(true);
    });

    it("should cover prefixItems constraint without explicit type", () => {
        const schema = { prefixItems: [{ type: "string" }, { type: "number" }] };
        const zodSchema = convertJsonSchemaToZod(schema);
        
        // Should enable array type implicitly
        expect(zodSchema.safeParse(["hello", 42]).success).toBe(true);
        expect(zodSchema.safeParse([42, "hello"]).success).toBe(false);
        expect(zodSchema.safeParse("string").success).toBe(true);
    });

    it("should not enable array type when no array constraints present", () => {
        const schema = { type: "string" };
        const zodSchema = convertJsonSchemaToZod(schema);
        
        // Should not enable array type
        expect(zodSchema.safeParse("hello").success).toBe(true);
        expect(zodSchema.safeParse([]).success).toBe(false);
        expect(zodSchema.safeParse(42).success).toBe(false);
    });

    it("should handle case where types.array is already set", () => {
        const schema = { type: "array", minItems: 1 };
        const zodSchema = convertJsonSchemaToZod(schema);
        
        // Should work with explicit array type
        expect(zodSchema.safeParse([1]).success).toBe(true);
        expect(zodSchema.safeParse([]).success).toBe(false);
        expect(zodSchema.safeParse("string").success).toBe(false);
    });
});