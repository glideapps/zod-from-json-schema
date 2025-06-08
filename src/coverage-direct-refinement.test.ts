import { describe, it, expect } from "vitest";
import { StringConstraintsHandler } from "./handlers/refinement/stringConstraints";
import { z } from "zod/v4";

describe("Direct StringConstraintsHandler Refinement Tests", () => {
    it("should execute refinement validation logic directly", () => {
        const handler = new StringConstraintsHandler();
        
        // Test minLength refinement
        const minLengthSchema = handler.apply(z.any(), { minLength: 5 });
        expect(minLengthSchema.safeParse("test").success).toBe(false);
        expect(minLengthSchema.safeParse("hello").success).toBe(true);
        expect(minLengthSchema.safeParse(123).success).toBe(true); // non-string
        
        // Test maxLength refinement
        const maxLengthSchema = handler.apply(z.any(), { maxLength: 3 });
        expect(maxLengthSchema.safeParse("test").success).toBe(false);
        expect(maxLengthSchema.safeParse("abc").success).toBe(true);
        expect(maxLengthSchema.safeParse(true).success).toBe(true); // non-string
        
        // Test pattern refinement
        const patternSchema = handler.apply(z.any(), { pattern: "^[0-9]+$" });
        expect(patternSchema.safeParse("abc").success).toBe(false);
        expect(patternSchema.safeParse("123").success).toBe(true);
        expect(patternSchema.safeParse([]).success).toBe(true); // non-string
        
        // Test all constraints together
        const allSchema = handler.apply(z.any(), {
            minLength: 2,
            maxLength: 5,
            pattern: "^[a-z]+$"
        });
        expect(allSchema.safeParse("a").success).toBe(false); // too short
        expect(allSchema.safeParse("abcdef").success).toBe(false); // too long
        expect(allSchema.safeParse("ABC").success).toBe(false); // wrong pattern
        expect(allSchema.safeParse("abc").success).toBe(true);
        expect(allSchema.safeParse(null).success).toBe(true); // non-string
    });

    it("should skip refinement when type is defined", () => {
        const handler = new StringConstraintsHandler();
        
        // With explicit type, handler returns unchanged
        const schema = handler.apply(z.string(), { 
            type: "string",
            minLength: 5 
        });
        
        // Should return the original schema unchanged
        expect(schema).toBeInstanceOf(z.ZodString);
    });
});