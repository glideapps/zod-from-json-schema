import { describe, it, expect } from "vitest";
import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { convertJsonSchemaToZod } from "./index";

// Regression tests for issue #45: the JSON Schema draft-4 boolean form of
// exclusiveMinimum/exclusiveMaximum must never disable the number type.
// exclusiveMinimum: true with a numeric sibling `minimum` makes the bound
// exclusive; exclusiveMinimum: false (or a boolean without a numeric
// sibling bound) is a no-op. Mirror semantics for exclusiveMaximum.
describe("Draft-4 boolean exclusiveMinimum/exclusiveMaximum (issue #45)", () => {

    it("does not disable number for exclusiveMaximum: true with a non-numeric sibling maximum", () => {
        const malformed = {
            type: "number",
            exclusiveMaximum: true,
            maximum: "x",
        } as unknown as JSONSchema.BaseSchema;
        const schema = convertJsonSchemaToZod(malformed);

        // The malformed `maximum: "x"` check itself rejects the value
        // (pre-existing MaximumHandler behavior), but the number type
        // must no longer be dropped to `never` by the boolean
        // exclusiveMaximum.
        const result = schema.safeParse(7);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.code).toBe("too_big");
    });
});
