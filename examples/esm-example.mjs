// ESM Example
import { convertJsonSchemaToZod } from '../dist/index.mjs';

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
    email: { 
      type: "string", 
      pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
      description: "User's email address"
    }
  },
  required: ["name", "email"],
  additionalProperties: false
};

// Convert JSON Schema to Zod schema
const zodSchema = convertJsonSchemaToZod(jsonSchema);

// Example of valid data
const validData = {
  name: "John Doe",
  email: "john@example.com"
};

// Validate the data
try {
  const validated = zodSchema.parse(validData);
  console.log("✅ ESM - Valid data:", validated);
} catch (error) {
  console.error("❌ ESM - Validation error:", error.errors);
}