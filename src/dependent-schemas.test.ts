import { describe, expect, it } from "vitest";
import { convertJsonSchemaToZod } from "./index";

describe("dependentSchemas keyword", () => {

    it("should ignore entries whose subschema is undefined", () => {
        const schema = convertJsonSchemaToZod({
            dependentSchemas: {
                foo: undefined,
            },
        } as any);

        expect(schema.safeParse({ foo: 1 }).success).toBe(true);
    });
});
