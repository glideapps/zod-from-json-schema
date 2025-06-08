import { describe, expect, it } from "vitest";
import { convertJsonSchemaToZod } from "./src/index";

describe("properties constraints debugging", () => {
    it("should handle maxProperties correctly", () => {
        const schema = convertJsonSchemaToZod({
            type: "object",
            maxProperties: 2
        });

        // Valid: 2 properties
        expect(schema.safeParse({ a: 1, b: 2 }).success).toBe(true);
        
        // Valid: 1 property
        expect(schema.safeParse({ a: 1 }).success).toBe(true);
        
        // Valid: 0 properties
        expect(schema.safeParse({}).success).toBe(true);
        
        // Invalid: 3 properties
        expect(schema.safeParse({ a: 1, b: 2, c: 3 }).success).toBe(false);
    });

    it("should handle minProperties correctly", () => {
        const schema = convertJsonSchemaToZod({
            type: "object",
            minProperties: 2
        });

        // Valid: 2 properties
        expect(schema.safeParse({ a: 1, b: 2 }).success).toBe(true);
        
        // Valid: 3 properties
        expect(schema.safeParse({ a: 1, b: 2, c: 3 }).success).toBe(true);
        
        // Invalid: 1 property
        expect(schema.safeParse({ a: 1 }).success).toBe(false);
        
        // Invalid: 0 properties
        expect(schema.safeParse({}).success).toBe(false);
    });

    it("should handle maxProperties = 0", () => {
        const schema = convertJsonSchemaToZod({
            type: "object",
            maxProperties: 0
        });

        // Valid: 0 properties
        expect(schema.safeParse({}).success).toBe(true);
        
        // Invalid: 1 property
        expect(schema.safeParse({ a: 1 }).success).toBe(false);
    });
});