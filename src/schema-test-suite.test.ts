import { describe, it, expect } from "vitest";
import { convertJsonSchemaToZod } from "./index";
import * as fs from "fs";
import * as path from "path";

interface SchemaTestCase {
    description: string;
    schema: any;
    tests: Array<{
        description: string;
        data: any;
        valid: boolean;
    }>;
}

describe("JSON Schema Test Suite (Draft 2020-12)", () => {
    const testSuiteDir = path.join(__dirname, "../test-suite/tests/draft2020-12");

    // Dynamically get all test files from the directory
    const testFiles = fs
        .readdirSync(testSuiteDir)
        .filter((file) => file.endsWith(".json"))
        .sort(); // Sort for consistent ordering

    testFiles.forEach((testFile) => {
        describe(testFile.replace(".json", ""), () => {
            if (!fs.existsSync(path.join(testSuiteDir, testFile))) {
                it.skip(`${testFile} not found`, () => {});
                return;
            }

            const testCases: SchemaTestCase[] = JSON.parse(fs.readFileSync(path.join(testSuiteDir, testFile), "utf8"));

            testCases.forEach((testCase) => {
                describe(testCase.description, () => {
                    const zodSchema = convertJsonSchemaToZod(testCase.schema);
                    testCase.tests.forEach((test) => {
                        it(test.description, () => {
                            const result = zodSchema.safeParse(test.data);

                            if (test.valid) {
                                expect(result.success).toBe(true);
                            } else {
                                expect(result.success).toBe(false);
                            }
                        });
                    });
                });
            });
        });
    });
});
