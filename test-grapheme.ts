import { convertJsonSchemaToZod } from "./src/index";

const schema = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "maxLength": 2
};

// Two poop emojis - 2 grapheme clusters but 4 UTF-16 code units
const testData = "💩💩";

console.log("Schema:", JSON.stringify(schema, null, 2));
console.log("\nTest data:", testData);
console.log("String length (UTF-16):", testData.length);
console.log("Code points:", Array.from(testData).length);

const zodSchema = convertJsonSchemaToZod(schema);
const result = zodSchema.safeParse(testData);

console.log("\nParse result:", result.success);
if (!result.success) {
    console.log("Error:", result.error.errors);
}