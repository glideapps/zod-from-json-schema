import { describe, it, expect } from "vitest";
import { convertJsonSchemaToZod } from "./index";

describe("Force Execution of Refinement Functions", () => {
    it("should execute string constraint validations", () => {
        // Test 1: minLength violation (lines 27-29)
        const schema1 = { minLength: 5 };
        const zod1 = convertJsonSchemaToZod(schema1);
        
        // Force execution of the refinement
        expect(() => zod1.parse("ab")).toThrow();
        expect(zod1.parse("hello")).toBe("hello");
        expect(zod1.parse(123)).toBe(123);

        // Test 2: maxLength violation (lines 31-33)  
        const schema2 = { maxLength: 3 };
        const zod2 = convertJsonSchemaToZod(schema2);
        
        expect(() => zod2.parse("long")).toThrow();
        expect(zod2.parse("ok")).toBe("ok");
        expect(zod2.parse(123)).toBe(123);

        // Test 3: pattern violation (lines 37-39)
        const schema3 = { pattern: "^[0-9]+$" };
        const zod3 = convertJsonSchemaToZod(schema3);
        
        expect(() => zod3.parse("abc")).toThrow();
        expect(zod3.parse("123")).toBe("123");
        expect(zod3.parse(true)).toBe(true);
    });

    it("should handle all string constraints together", () => {
        const schema = {
            minLength: 3,
            maxLength: 5,
            pattern: "^[a-z]+$"
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        
        // Test various failures
        expect(() => zodSchema.parse("ab")).toThrow(); // too short
        expect(() => zodSchema.parse("abcdef")).toThrow(); // too long
        expect(() => zodSchema.parse("ABC")).toThrow(); // wrong pattern
        expect(() => zodSchema.parse("12")).toThrow(); // too short AND wrong pattern
        
        // Test success cases
        expect(zodSchema.parse("abc")).toBe("abc");
        expect(zodSchema.parse("abcd")).toBe("abcd");
        expect(zodSchema.parse("abcde")).toBe("abcde");
        
        // Non-strings pass through
        expect(zodSchema.parse(12345)).toBe(12345);
        expect(zodSchema.parse(null)).toBe(null);
        expect(zodSchema.parse(true)).toBe(true);
    });
});