import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { convertJsonSchemaToZod, jsonSchemaObjectToZodRawShape } from "./index";
import { convertSchemaRefs } from "./core/refs";

function accepts(schema: any, value: unknown): void {
    const zodSchema = convertJsonSchemaToZod(schema);
    expect(zodSchema.safeParse(value).success).toBe(true);
}

function rejects(schema: any, value: unknown): void {
    const zodSchema = convertJsonSchemaToZod(schema);
    expect(zodSchema.safeParse(value).success).toBe(false);
}

describe("$ref support", () => {

    describe("recursion", () => {
        it("validates a self-recursive linked list", () => {
            const schema = {
                type: "object",
                properties: {
                    value: { type: "integer" },
                    next: { $ref: "#" },
                },
                required: ["value"],
                additionalProperties: false,
            };
            accepts(schema, { value: 1 });
            accepts(schema, { value: 1, next: { value: 2 } });
            accepts(schema, {
                value: 1,
                next: { value: 2, next: { value: 3 } },
            });
            rejects(schema, { value: 1, next: { value: "two" } });
            rejects(schema, { value: 1, next: { next: { value: 3 } } });
            rejects(schema, {
                value: 1,
                next: { value: 2, extra: true },
            });

            // Moderately deep recursive data must not exhaust the stack.
            const deep: any = { value: 0 };
            let cursor = deep;
            for (let i = 1; i < 100; i++) {
                cursor.next = { value: i };
                cursor = cursor.next;
            }
            accepts(schema, deep);
            cursor.next = { value: "not an integer" };
            rejects(schema, deep);
        });
    });

    describe("interaction with existing pipelines", () => {

        it("does not let hazardous property names in $defs pollute prototypes", () => {
            const schema = JSON.parse(
                '{"$ref": "#/$defs/__proto__", "$defs": {"__proto__": {"type": "integer"}}}',
            );
            accepts(schema, 5);
            rejects(schema, "x");
            expect(Object.prototype.hasOwnProperty.call(Object.prototype, "type")).toBe(false);
        });
    });

    describe("jsonSchemaObjectToZodRawShape", () => {
        it("keeps refs pointing outside a property schema permissive", () => {
            const shape = jsonSchemaObjectToZodRawShape({
                properties: {
                    foo: { $ref: "#/$defs/a" },
                },
                $defs: { a: { type: "integer" } },
            } as any);
            expect(shape.foo.safeParse("anything").success).toBe(true);
        });

        it("resolves refs contained within a property schema", () => {
            const shape = jsonSchemaObjectToZodRawShape({
                properties: {
                    foo: {
                        $ref: "#/$defs/a",
                        $defs: { a: { type: "integer" } },
                    },
                },
                required: ["foo"],
            } as any);
            expect(shape.foo.safeParse(5).success).toBe(true);
            expect(shape.foo.safeParse("x").success).toBe(false);
        });
    });

    describe("bare references return the target schema directly", () => {
        it("returns the target's Zod class for a bare $ref", () => {
            const zodSchema = convertJsonSchemaToZod({
                $ref: "#/$defs/s",
                $defs: { s: { type: "string" } },
            } as any);
            expect(zodSchema).toBeInstanceOf(z.ZodString);
            expect(zodSchema.safeParse("hello").success).toBe(true);
            expect(zodSchema.safeParse(5).success).toBe(false);
        });

        it("returns the target's Zod class for a bare $dynamicRef", () => {
            const zodSchema = convertJsonSchemaToZod({
                $dynamicRef: "#/$defs/n",
                $defs: { n: { type: "number" } },
            } as any);
            expect(zodSchema).toBeInstanceOf(z.ZodNumber);
            expect(zodSchema.safeParse(1.5).success).toBe(true);
            expect(zodSchema.safeParse("x").success).toBe(false);
        });

        it("returns object targets directly", () => {
            const zodSchema = convertJsonSchemaToZod({
                $ref: "#/$defs/o",
                $defs: {
                    o: {
                        type: "object",
                        properties: { x: { type: "integer" } },
                        required: ["x"],
                    },
                },
            } as any);
            expect(zodSchema).toBeInstanceOf(z.ZodObject);
            expect(zodSchema.safeParse({ x: 1 }).success).toBe(true);
            expect(zodSchema.safeParse({}).success).toBe(false);
        });

        it("resolves chains of bare refs to the final target", () => {
            const zodSchema = convertJsonSchemaToZod({
                $ref: "#/$defs/a",
                $defs: {
                    a: { $ref: "#/$defs/b" },
                    b: { type: "number" },
                },
            } as any);
            expect(zodSchema).toBeInstanceOf(z.ZodNumber);
            expect(zodSchema.safeParse(1.5).success).toBe(true);
            expect(zodSchema.safeParse("x").success).toBe(false);
        });

        it("returns boolean targets directly", () => {
            const always = convertJsonSchemaToZod({
                $ref: "#/$defs/anything",
                $defs: { anything: true },
            } as any);
            expect(always).toBeInstanceOf(z.ZodAny);
            expect(always.safeParse({ any: "thing" }).success).toBe(true);

            const never = convertJsonSchemaToZod({
                $ref: "#/$defs/nothing",
                $defs: { nothing: false },
            } as any);
            expect(never).toBeInstanceOf(z.ZodNever);
            expect(never.safeParse(5).success).toBe(false);
        });

        it("applies the referencing node's description to its own result", () => {
            const zodSchema = convertJsonSchemaToZod({
                $ref: "#/$defs/s",
                description: "outer",
                $defs: { s: { type: "string" } },
            } as any);
            expect(zodSchema).toBeInstanceOf(z.ZodString);
            expect(zodSchema.description).toBe("outer");
        });

        it("keeps the referencing node's description off the shared target", () => {
            const zodSchema = convertJsonSchemaToZod({
                type: "object",
                properties: {
                    a: { $ref: "#/$defs/s", description: "outer" },
                    b: { $ref: "#/$defs/s" },
                },
                $defs: { s: { type: "string" } },
            } as any) as z.ZodObject<z.ZodRawShape>;
            expect(zodSchema).toBeInstanceOf(z.ZodObject);
            // Non-required properties are wrapped in ZodOptional.
            const a = (zodSchema.shape.a as z.ZodOptional<z.ZodTypeAny>).unwrap();
            const b = (zodSchema.shape.b as z.ZodOptional<z.ZodTypeAny>).unwrap();
            expect(a).toBeInstanceOf(z.ZodString);
            expect(a.description).toBe("outer");
            expect(b).toBeInstanceOf(z.ZodString);
            expect(b.description).toBeUndefined();
        });

        it("keeps refine-based composition when sibling constraints exist", () => {
            const zodSchema = convertJsonSchemaToZod({
                $ref: "#/$defs/max5",
                type: "integer",
                $defs: { max5: { maximum: 5 } },
            } as any);
            expect(zodSchema).toBeInstanceOf(z.ZodNumber);
            expect(zodSchema.safeParse(3).success).toBe(true);
            expect(zodSchema.safeParse(7).success).toBe(false);
            expect(zodSchema.safeParse("x").success).toBe(false);
        });

        it("returns completed recursive targets directly and keeps recursion working", () => {
            const zodSchema = convertJsonSchemaToZod({
                $ref: "#/$defs/tree",
                $defs: {
                    tree: {
                        type: "object",
                        properties: {
                            children: {
                                type: "array",
                                items: { $ref: "#/$defs/tree" },
                            },
                        },
                    },
                },
            } as any);
            // The tree target's conversion completes before the root's bare
            // ref is resolved, so the root gets the target directly; only
            // the inner self-reference stays a deferred refinement.
            expect(zodSchema).toBeInstanceOf(z.ZodObject);
            expect(zodSchema.safeParse({ children: [{ children: [] }] }).success).toBe(true);
            expect(zodSchema.safeParse({ children: [{ children: [5] }] }).success).toBe(false);
        });

        it("keeps no-progress cycles and unresolvable refs permissive", () => {
            const selfCycle = convertJsonSchemaToZod({ $ref: "#" } as any);
            expect(selfCycle).toBeInstanceOf(z.ZodAny);
            expect(selfCycle.safeParse(5).success).toBe(true);

            const unresolvable = convertJsonSchemaToZod({
                $ref: "#/$defs/missing",
                $defs: { a: { type: "integer" } },
            } as any);
            expect(unresolvable).toBeInstanceOf(z.ZodAny);
            expect(unresolvable.safeParse("anything").success).toBe(true);
        });
    });

    describe("conversion reuse", () => {

        it("resolves nothing outside an active conversion", () => {
            expect(convertSchemaRefs({ $ref: "#" } as any)).toEqual([]);
        });
    });
});
