// This example demonstrates how to use zod-from-json-schema
const { convertJsonSchemaToZod } = require('./dist/index');

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
    },
    email: { 
      type: "string", 
      pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
      description: "User's email address"
    },
    tags: {
      type: "array",
      items: { type: "string" },
      uniqueItems: true,
      minItems: 1,
      description: "User's tags or categories"
    }
  },
  required: ["name", "email"],
  additionalProperties: false,
  description: "A user profile schema"
};

// Convert JSON Schema to Zod schema
const zodSchema = convertJsonSchemaToZod(jsonSchema);

// Example of valid data
const validData = {
  name: "John Doe",
  email: "john@example.com",
  age: 30,
  tags: ["user", "premium"]
};

// Validate the data
try {
  const validated = zodSchema.parse(validData);
  console.log("✅ Valid data:", validated);
} catch (error) {
  console.error("❌ Validation error:", error.errors);
}

// Example of invalid data
const invalidData = {
  name: "J", // Too short - minLength is 2
  email: "not-an-email", // Invalid email format
  age: 150, // Above maximum of 120
  tags: ["user", "user"] // Duplicate items - uniqueItems is true
};

// Validate the invalid data (will throw an error)
try {
  const validated = zodSchema.parse(invalidData);
  console.log("Valid data:", validated);
} catch (error) {
  console.error("❌ Validation errors:", error.format());
}

// Example of safeParse - doesn't throw errors
const safeResult = zodSchema.safeParse(invalidData);
if (safeResult.success) {
  console.log("✅ Valid data:", safeResult.data);
} else {
  console.log("❌ Invalid data, issues:");
  console.log(safeResult.error.format());
}