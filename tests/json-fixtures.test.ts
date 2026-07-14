import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import type { JSONSchema } from "zod/v4/core";
import { convertJsonSchemaToZod } from "../src";

const fixturesRoot = __dirname;
const fixturePattern = new RegExp(
    "^(?<base>.+)\\.(?<kind>schema|(?<expectation>pass|fail)\\." +
        "(?<caseId>[A-Za-z0-9][A-Za-z0-9_-]*))\\.json$",
);

interface FixtureFile {
    absolutePath: string;
    caseId: string;
    expectation: "pass" | "fail";
    relativePath: string;
}

interface FixtureGroup {
    fixtures: FixtureFile[];
    name: string;
    schemaPath: string;
}

function findJsonFiles(directory: string): string[] {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            return findJsonFiles(entryPath);
        }

        return entry.isFile() && entry.name.endsWith(".json")
            ? [entryPath]
            : [];
    });
}

function readJson(filePath: string): unknown {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
            `Could not parse ${path.relative(fixturesRoot, filePath)}: ${message}`,
        );
    }
}

function discoverFixtureGroups(): FixtureGroup[] {
    const groups = new Map<string, FixtureGroup>();
    const fixtures: Array<FixtureFile & { groupName: string }> = [];

    for (const absolutePath of findJsonFiles(fixturesRoot).sort()) {
        const relativePath = path.relative(fixturesRoot, absolutePath);
        const parsed = path.basename(relativePath).match(fixturePattern);

        if (parsed?.groups === undefined) {
            throw new Error(
                `Unrecognized JSON fixture name: ${relativePath}. ` +
                    "See tests/README.md for the naming convention.",
            );
        }

        const directory = path.dirname(relativePath);
        const groupName = path.join(directory, parsed.groups.base);

        if (parsed.groups.kind === "schema") {
            if (groups.has(groupName)) {
                throw new Error(`Duplicate schema fixture: ${groupName}`);
            }

            groups.set(groupName, {
                fixtures: [],
                name: groupName,
                schemaPath: absolutePath,
            });
            continue;
        }

        fixtures.push({
            absolutePath,
            caseId: parsed.groups.caseId,
            expectation: parsed.groups.expectation as "pass" | "fail",
            groupName,
            relativePath,
        });
    }

    for (const fixture of fixtures) {
        const group = groups.get(fixture.groupName);

        if (group === undefined) {
            throw new Error(
                `Fixture ${fixture.relativePath} has no matching ` +
                    `${fixture.groupName}.schema.json`,
            );
        }

        group.fixtures.push(fixture);
    }

    for (const group of groups.values()) {
        if (group.fixtures.length === 0) {
            throw new Error(
                `Schema ${group.name}.schema.json has no pass or fail fixtures`,
            );
        }
    }

    return [...groups.values()].sort((left, right) =>
        left.name.localeCompare(right.name),
    );
}

describe("JSON validation fixtures", () => {
    for (const group of discoverFixtureGroups()) {
        describe(group.name, () => {
            const schema = readJson(group.schemaPath) as
                | JSONSchema.BaseSchema
                | boolean;
            const zodSchema = convertJsonSchemaToZod(schema);

            for (const fixture of group.fixtures) {
                it(`${fixture.expectation}.${fixture.caseId}`, () => {
                    const input = readJson(fixture.absolutePath);
                    const result = zodSchema.safeParse(input);

                    if (fixture.expectation === "pass") {
                        const details = result.success
                            ? undefined
                            : JSON.stringify(result.error.issues, null, 2);
                        expect(result.success, details).toBe(true);
                    } else {
                        const details = result.success
                            ? `Unexpectedly accepted ${JSON.stringify(input)}`
                            : undefined;
                        expect(result.success, details).toBe(false);
                    }
                });
            }
        });
    }
});
