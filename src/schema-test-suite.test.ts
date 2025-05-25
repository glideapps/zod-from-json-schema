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

    // Load the skip list of currently failing tests
    const skipListPath = path.join(__dirname, "../failing-tests-skip-list.json");
    let skipList: string[] = [];
    if (fs.existsSync(skipListPath)) {
        skipList = JSON.parse(fs.readFileSync(skipListPath, "utf8"));
    }

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
                    testCase.tests.forEach((test) => {
                        const testKey = `${testFile.replace(".json", "")}|${testCase.description}|${test.description}`;
                        const shouldSkip = skipList.includes(testKey);

                        const testFn = shouldSkip ? it.skip : it;

                        testFn(test.description, () => {
                            const zodSchema = convertJsonSchemaToZod(testCase.schema);
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
