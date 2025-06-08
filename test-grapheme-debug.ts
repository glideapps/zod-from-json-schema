import { convertJsonSchemaToZod } from "./src/index";

// Test schema without explicit type, just maxLength
const schema = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "maxLength": 2
};

console.log("Schema:", JSON.stringify(schema, null, 2));

const zodSchema = convertJsonSchemaToZod(schema);
console.log("\nZod schema type:", zodSchema._def.typeName);

// Test different values
const testCases = [
    "ab",        // 2 ASCII chars - should pass
    "💩💩",      // 2 emojis (4 UTF-16 units) - should pass 
    "abc",       // 3 ASCII chars - should fail
    123,         // number - should pass (not a string)
    { a: 1 },    // object - should pass (not a string)
    null,        // null - should pass (not a string)
];

console.log("\nTest results:");
for (const testValue of testCases) {
    const result = zodSchema.safeParse(testValue);
    const displayValue = typeof testValue === "string" ? `"${testValue}"` : JSON.stringify(testValue);
    console.log(`  ${displayValue}: ${result.success ? "✓ pass" : "✗ fail"}`);
}