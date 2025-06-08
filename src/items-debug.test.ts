import { describe, expect, it } from "vitest";
import { convertJsonSchemaToZod } from "./index";

describe("items keyword debugging", () => {
    it("should handle items: false correctly", () => {
        const schema = convertJsonSchemaToZod({
            items: false
        });

        // Empty arrays should be valid
        expect(schema.safeParse([]).success).toBe(true);
        
        // Non-empty arrays should be invalid  
        expect(schema.safeParse([1]).success).toBe(false);
        expect(schema.safeParse([1, "foo", true]).success).toBe(false);
        
        // Non-arrays should be valid (JSON Schema only applies items to arrays)
        expect(schema.safeParse("string").success).toBe(true);
        expect(schema.safeParse(123).success).toBe(true);
        expect(schema.safeParse({}).success).toBe(true);
    });

    it("should handle items: true correctly", () => {
        const schema = convertJsonSchemaToZod({
            items: true
        });

        // All arrays should be valid
        expect(schema.safeParse([]).success).toBe(true);
        expect(schema.safeParse([1]).success).toBe(true);
        expect(schema.safeParse([1, "foo", true]).success).toBe(true);
        
        // Non-arrays should be valid 
        expect(schema.safeParse("string").success).toBe(true);
        expect(schema.safeParse(123).success).toBe(true);
        expect(schema.safeParse({}).success).toBe(true);
    });

    it("should handle items with schema correctly", () => {
        const schema = convertJsonSchemaToZod({
            items: { type: "number" }
        });

        // Arrays with valid items should be valid
        expect(schema.safeParse([]).success).toBe(true);
        expect(schema.safeParse([1, 2, 3]).success).toBe(true);
        
        // Arrays with invalid items should be invalid
        expect(schema.safeParse([1, "foo"]).success).toBe(false);
        expect(schema.safeParse(["foo"]).success).toBe(false);
        
        // Non-arrays should be valid
        expect(schema.safeParse("string").success).toBe(true);
        expect(schema.safeParse(123).success).toBe(true);
    });
});