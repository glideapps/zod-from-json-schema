import { describe, it, expect } from "vitest";
import { convertJsonSchemaToZod } from "./index";

describe("String Constraints Edge Cases", () => {
    // The StringConstraintsHandler only applies when there's no explicit type
    // but has string-specific constraints
    
    it("should apply string constraints without explicit type - minLength", () => {
        const schema = {
            minLength: 5
            // No type specified
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        
        // Strings should be validated
        expect(() => zodSchema.parse("ab")).toThrow();
        expect(zodSchema.parse("hello")).toBe("hello");
        expect(zodSchema.parse("longer string")).toBe("longer string");
        
        // Non-strings should pass through
        expect(zodSchema.parse(123)).toBe(123);
        expect(zodSchema.parse(true)).toBe(true);
        expect(zodSchema.parse(null)).toBe(null);
        expect(zodSchema.parse([1, 2, 3])).toEqual([1, 2, 3]);
        expect(zodSchema.parse({ foo: "bar" })).toEqual({ foo: "bar" });
    });

    it("should apply string constraints without explicit type - maxLength", () => {
        const schema = {
            maxLength: 3
            // No type specified
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        
        // Strings should be validated
        expect(zodSchema.parse("ab")).toBe("ab");
        expect(zodSchema.parse("abc")).toBe("abc");
        expect(() => zodSchema.parse("abcd")).toThrow();
        expect(() => zodSchema.parse("longer")).toThrow();
        
        // Non-strings should pass through
        expect(zodSchema.parse(12345)).toBe(12345);
        expect(zodSchema.parse(false)).toBe(false);
        expect(zodSchema.parse(null)).toBe(null);
        expect(zodSchema.parse([1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5]);
    });

    it("should apply string constraints without explicit type - pattern", () => {
        const schema = {
            pattern: "^[0-9]+$"
            // No type specified
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        
        // Strings should be validated
        expect(zodSchema.parse("123")).toBe("123");
        expect(zodSchema.parse("0")).toBe("0");
        expect(() => zodSchema.parse("abc")).toThrow();
        expect(() => zodSchema.parse("12a")).toThrow();
        expect(() => zodSchema.parse("")).toThrow();
        
        // Non-strings should pass through
        expect(zodSchema.parse(123)).toBe(123);
        expect(zodSchema.parse(true)).toBe(true);
        expect(zodSchema.parse(null)).toBe(null);
        expect(zodSchema.parse({ num: 123 })).toEqual({ num: 123 });
    });

    it("should apply all string constraints together without explicit type", () => {
        const schema = {
            minLength: 2,
            maxLength: 5,
            pattern: "^[a-z]+$"
            // No type specified
        };
        
        const zodSchema = convertJsonSchemaToZod(schema);
        
        // Valid strings
        expect(zodSchema.parse("ab")).toBe("ab");
        expect(zodSchema.parse("abc")).toBe("abc");
        expect(zodSchema.parse("abcd")).toBe("abcd");
        expect(zodSchema.parse("abcde")).toBe("abcde");
        
        // Invalid strings
        expect(() => zodSchema.parse("a")).toThrow(); // too short
        expect(() => zodSchema.parse("abcdef")).toThrow(); // too long
        expect(() => zodSchema.parse("AB")).toThrow(); // wrong pattern
        expect(() => zodSchema.parse("a1")).toThrow(); // wrong pattern
        expect(() => zodSchema.parse("12")).toThrow(); // wrong pattern
        
        // Non-strings should pass through
        expect(zodSchema.parse(12345)).toBe(12345);
        expect(zodSchema.parse(true)).toBe(true);
        expect(zodSchema.parse(false)).toBe(false);
        expect(zodSchema.parse(null)).toBe(null);
        expect(zodSchema.parse([])).toEqual([]);
        expect(zodSchema.parse({})).toEqual({});
    });
});