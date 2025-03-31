// CommonJS Example
const { convertJsonSchemaToZod } = require('../dist/index.js');

// Define a JSON Schema
const jsonSchema = {
  type: "object",
  properties: {
    name: { 
      type: "string", 
      minLength: 2, 
      maxLength: 50,
      description: "User's full name"
    },
    age: { 
      type: "integer", 
      minimum: 0, 
      maximum: 120,
      description: "User's age in years"
    }
  },
  required: ["name"],
  additionalProperties: false
};

// Convert JSON Schema to Zod schema
const zodSchema = convertJsonSchemaToZod(jsonSchema);

// Example of valid data
const validData = {
  name: "John Doe",
  age: 30
};

// Validate the data
try {
  const validated = zodSchema.parse(validData);
  console.log("✅ CJS - Valid data:", validated);
} catch (error) {
  console.error("❌ CJS - Validation error:", error.errors);
}