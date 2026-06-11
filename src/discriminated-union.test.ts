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

// The schema exactly as reported in issue #19. Unlike the schema above, the
// variants have no `required` properties, so distinguishing them relies on
// `unevaluatedProperties: false`, which this library does not support. These
// tests document which parts of the issue are fixed for the verbatim schema.
const verbatimSchema = {
    type: "object",
    required: ["nodeType", "parentNodeId"],
    properties: {
        parentNodeId: {
            type: "string",
        },
        value: {
            type: "string",
        },
    },
    oneOf: [
        {
            properties: {
                nodeType: { const: "QUESTION" },
                nodeSpecifics: {
                    type: "object",
                    properties: {
                        questionName: {
                            type: ["string", "null"],
                        },
                    },
                    unevaluatedProperties: false,
                },
            },
        },
        {
            properties: {
                nodeType: { const: "DECISION" },
                nodeSpecifics: {
                    type: "object",
                    properties: {
                        notes: { type: ["string", "null"] },
                    },
                    unevaluatedProperties: false,
                },
            },
        },
    ],
    unevaluatedProperties: false,
};

describe("verbatim issue #19 schema", () => {
    it("should validate a matching variant", () => {
        const input = {
            parentNodeId: "123",
            value: "456",
            nodeType: "QUESTION",
            nodeSpecifics: {
                questionName: "What is your name?",
            },
        };

        const zodSchema = convertJsonSchemaToZod(verbatimSchema as any);
        expect(zodSchema.safeParse(input).success).toBe(true);
    });

    it("should not validate an unknown discriminator value", () => {
        const input = {
            parentNodeId: "123",
            value: "456",
            nodeType: "INVALID",
            nodeSpecifics: {
                notes: "some notes",
            },
        };

        const zodSchema = convertJsonSchemaToZod(verbatimSchema as any);
        expect(zodSchema.safeParse(input).success).toBe(false);
    });

    it("accepts mismatched nodeSpecifics because unevaluatedProperties is unsupported", () => {
        // A full JSON Schema validator would reject this input: questionName is
        // unevaluated in the DECISION variant. Without unevaluatedProperties
        // support, questionName counts as an allowed additional property, so
        // exactly one oneOf branch matches and validation passes. Adding
        // `required` to each variant (as in the schema at the top of this file)
        // makes the mismatch detectable.
        const input = {
            parentNodeId: "123",
            value: "456",
            nodeType: "DECISION",
            nodeSpecifics: {
                questionName: "What is your name?",
            },
        };

        const zodSchema = convertJsonSchemaToZod(verbatimSchema as any);
        expect(zodSchema.safeParse(input).success).toBe(true);
    });
});
