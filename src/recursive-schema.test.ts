import { describe, expect, it } from "vitest";
import { convertJsonSchemaToZod } from "./index";

const recursiveSchema = {
    items: {
        anyOf: [
            { $ref: "#/definitions/a" },
            { additionalProperties: { $ref: "#" } },
        ],
    },
    definitions: {
        a: {
            properties: {
                x: { items: { $ref: "#/definitions/a" } },
            },
        },
    },
} as any;

describe("recursive schema", () => {
    it("converts a recursive schema without overflowing", () => {
        const zodSchema = convertJsonSchemaToZod(recursiveSchema);

        const validJsonValues = [
            [],
            [1],
            [{ x: [] }],
            [{ x: [{ x: [] }] }],
            [{ foo: [] }],
            [{ foo: [1] }],
            [{ foo: { bar: [] } }],
            "not array",
            123,
            { foo: [] },
            null,
        ];

        for (const value of validJsonValues) {
            expect(zodSchema.safeParse(value).success).toBe(true);
        }

        expect(zodSchema.safeParse(undefined).success).toBe(false);
    });
});
