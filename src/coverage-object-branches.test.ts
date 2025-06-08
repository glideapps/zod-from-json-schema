import { describe, expect, it } from "vitest";
import { convertJsonSchemaToZod } from "./index";

describe("coverage for object handler branches", () => {
    it("should cover maxProperties with existing object type", () => {
        // This should trigger the case where types.object is already set 
        // when MaxPropertiesHandler runs, covering the left side of the || operator
        const schema = convertJsonSchemaToZod({
            type: "object",      // This creates an object type first
            maxProperties: 2,    // This should use the existing types.object
            additionalProperties: true  // Allow extra properties for testing
        });

        // Test that it works
        expect(schema.safeParse({ foo: "bar" }).success).toBe(true);
        expect(schema.safeParse({ foo: "bar", baz: 1, qux: 2 }).success).toBe(false);
    });

    it("should cover minProperties with existing object type", () => {
        // Same for MinPropertiesHandler
        const schema = convertJsonSchemaToZod({
            type: "object",      // This creates an object type first
            minProperties: 1,    // This should use the existing types.object
            additionalProperties: true  // Allow extra properties for testing
        });

        // Test that it works
        expect(schema.safeParse({ foo: "bar" }).success).toBe(true);
        expect(schema.safeParse({}).success).toBe(false);
    });

    it("should cover both min and max properties with existing object type", () => {
        // Cover both handlers with existing object type
        const schema = convertJsonSchemaToZod({
            type: "object",
            minProperties: 1,
            maxProperties: 2,
            additionalProperties: true  // Allow extra properties for testing
        });

        // Test all constraints
        expect(schema.safeParse({}).success).toBe(false);  // violates minProperties
        expect(schema.safeParse({ foo: "test" }).success).toBe(true);  // valid
        expect(schema.safeParse({ foo: "test", bar: 42 }).success).toBe(true);  // valid
        expect(schema.safeParse({ foo: "test", bar: 42, baz: "extra" }).success).toBe(false);  // violates maxProperties
    });
});