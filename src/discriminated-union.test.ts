import { describe, it, expect } from "vitest";
import { convertJsonSchemaToZod } from "./core/converter";

const schema = {
    type: "object",
    required: ["nodeType", "parentNodeId"],
    properties: {
        // Common properties defined ONCE at the top level
        parentNodeId: {
            type: "string",
        },
        value: {
            type: "string",
        },
    },
    oneOf: [
        {
            // QUESTION Node - only discriminator and variant-specific properties
            properties: {
                nodeType: { const: "QUESTION" },
                nodeSpecifics: {
                    type: "object",
                    properties: {
                        questionName: {
                            type: ["string", "null"],
                        },
                    },
                    required: ["questionName"],
                    unevaluatedProperties: false,
                },
            },
        },
        {
            // DECISION Node
            properties: {
                nodeType: { const: "DECISION" },
                nodeSpecifics: {
                    type: "object",
                    properties: {
                        notes: { type: ["string", "null"] },
                    },
                    required: ["notes"],
                    unevaluatedProperties: false,
                },
            },
        },
    ],
    unevaluatedProperties: false,
};

it("should validate QUESTION", () => {
    const input = {
        parentNodeId: "123",
        value: "456",
        nodeType: "QUESTION", // the type here defines what's allowed in the nodeSpecifics, and in this case they match
        nodeSpecifics: {
            questionName: "What is your name?",
        },
    };

    const zodSchema = convertJsonSchemaToZod(schema as any);
    expect(zodSchema.safeParse(input).success).toBe(true);
});

it("should validate DECISION", () => {
    const input = {
        parentNodeId: "123",
        value: "456",
        nodeType: "DECISION", // the type here defines what's allowed in the nodeSpecifics, and in this case they match
        nodeSpecifics: {
            notes: "some notes",
        },
    };

    const zodSchema = convertJsonSchemaToZod(schema as any);
    expect(zodSchema.safeParse(input).success).toBe(true);
});

it("should not validate DECISION with questionName", () => {
    const input = {
        parentNodeId: "123",
        value: "456",
        nodeType: "DECISION", // the type here defines what's allowed in the nodeSpecifics, and in this case they do not match
        nodeSpecifics: {
            questionName: "What is your name?",
        },
    };

    const zodSchema = convertJsonSchemaToZod(schema as any);
    expect(zodSchema.safeParse(input).success).toBe(false);
});

it("should not validate QUESTION with notes", () => {
    const input = {
        parentNodeId: "123",
        value: "456",
        nodeType: "QUESTION", // the type here defines what's allowed in the nodeSpecifics, and in this case they do not match
        nodeSpecifics: {
            notes: "some notes",
        },
    };

    const zodSchema = convertJsonSchemaToZod(schema as any);
    expect(zodSchema.safeParse(input).success).toBe(false);
});

it("should not validate INVALID", () => {
    const input = {
        parentNodeId: "123",
        value: "456",
        nodeType: "INVALID", // the type here defines what's allowed in the nodeSpecifics, the node type is completely invalid
        nodeSpecifics: {
            notes: "some notes",
        },
    };

    const zodSchema = convertJsonSchemaToZod(schema as any);
    expect(zodSchema.safeParse(input).success).toBe(false);
});
