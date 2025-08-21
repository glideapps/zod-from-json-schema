import { describe, it, expect } from "vitest";
import { convertJsonSchemaToZod } from "./index";
import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import jsonExampleData from "./examples.json" assert { type: "json"};
const examples = jsonExampleData as JSONSchema.BaseSchema[];


// Helper function to find differences between objects
function findDifferences(original: any, result: any, path = ""): string[] {
  const differences: string[] = [];

  // Check for missing properties in result
  Object.keys(original).forEach((key) => {
    const currentPath = path ? `${path}.${key}` : key;

    if (!(key in result)) {
      differences.push(`Missing property: ${currentPath}`);
      return;
    }

    if (
      typeof original[key] === "object" &&
      original[key] !== null &&
      typeof result[key] === "object" &&
      result[key] !== null
    ) {
      // Recursively check nested objects
      differences.push(...findDifferences(original[key], result[key], currentPath));
    } else if (original[key] !== result[key]) {
      differences.push(
        `Value mismatch at ${currentPath}: expected ${JSON.stringify(original[key])}, got ${JSON.stringify(result[key])}`,
      );
    }
  });

  // Check for extra properties in result
  Object.keys(result).forEach((key) => {
    const currentPath = path ? `${path}.${key}` : key;
    if (!(key in original)) {
      differences.push(`Extra property: ${currentPath}`);
    }
  });

  return differences;
}

describe("examples tests", () => {
  const results = {
    passed: 0,
    failed: 0,
    failures: [] as { index: number; differences: string[] }[],
  };

  // Run tests for each example
  examples.forEach((example, index) => {
    it(`should correctly convert example ${index}`, () => {
      try {
        // Convert JSON schema to Zod
        const zodSchema = convertJsonSchemaToZod(example);

        // Convert Zod schema back to JSON schema
        const resultSchema = z.toJSONSchema(zodSchema);

        // Find differences between the schemas
        const differences = findDifferences(example, resultSchema);

        if (differences.length === 0) {
          results.passed++;
          expect(resultSchema).toEqual(example); // This should pass
        } else {
          results.failed++;
          results.failures.push({
            index,
            differences,
          });
          // Log the differences for this specific test
          console.log(`\nDifferences in example ${index}:`);
          differences.forEach((diff) => console.log(`- ${diff}`));

          expect(resultSchema).toEqual(example); // This will fail with a detailed diff
        }
      } catch (error) {
        results.failed++;
        results.failures.push({
          index,
          differences: [error instanceof Error ? error.message : String(error)],
        });
        throw error;
      }
    });
  });

  // Print summary at the end
  it("should print test summary", () => {
    console.log("\n--- Test Summary ---");
    console.log(`Total examples: ${examples.length}`);
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);

    if (results.failures.length > 0) {
      console.log("\nCommon issues found:");

      // Collect all unique differences
      const allDifferences = results.failures.flatMap((failure) => failure.differences);
      const uniqueDifferences = [...new Set(allDifferences)];

      // Find the most common patterns
      const patterns: Record<string, number> = {};

      uniqueDifferences.forEach((diff) => {
        // Extract patterns like "Missing property: X.const" or "Missing property: X.description"
        if (diff.includes(".const")) {
          patterns["Missing const properties"] = (patterns["Missing const properties"] || 0) + 1;
        } else if (diff.includes(".description")) {
          patterns["Missing description properties"] = (patterns["Missing description properties"] || 0) + 1;
        } else if (diff.includes("Value mismatch")) {
          patterns["Value mismatches"] = (patterns["Value mismatches"] || 0) + 1;
        } else if (diff.includes("Extra property")) {
          patterns["Extra properties"] = (patterns["Extra properties"] || 0) + 1;
        } else if (diff.includes("Missing property")) {
          patterns["Missing properties"] = (patterns["Missing properties"] || 0) + 1;
        }
      });

      // Print common patterns
      Object.entries(patterns)
        .sort((a, b) => b[1] - a[1])
        .forEach(([pattern, count]) => {
          console.log(`- ${pattern}: ${count} occurrences`);
        });
    }
  });
});
