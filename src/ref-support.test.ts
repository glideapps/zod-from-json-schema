import { describe, expect, it } from "vitest";
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
    describe("basic references", () => {
        it("resolves a $ref into $defs", () => {
            const schema = {
                $ref: "#/$defs/a",
                $defs: { a: { type: "integer" } },
            };
            accepts(schema, 5);
            rejects(schema, "hello");
        });

        it("resolves a $ref into definitions", () => {
            const schema = {
                $ref: "#/definitions/a",
                definitions: { a: { type: "string" } },
            };
            accepts(schema, "hello");
            rejects(schema, 5);
        });

        it("resolves nested refs (ref to a ref)", () => {
            const schema = {
                $ref: "#/$defs/a",
                $defs: {
                    a: { $ref: "#/$defs/b" },
                    b: { type: "number" },
                },
            };
            accepts(schema, 1.5);
            rejects(schema, "no");
        });

        it("resolves refs inside properties", () => {
            const schema = {
                type: "object",
                properties: {
                    name: { $ref: "#/$defs/nonEmpty" },
                },
                $defs: { nonEmpty: { type: "string", minLength: 1 } },
            };
            accepts(schema, { name: "x" });
            accepts(schema, {});
            rejects(schema, { name: "" });
            rejects(schema, { name: 5 });
        });

        it("applies sibling keywords conjunctively with $ref", () => {
            const schema = {
                $ref: "#/$defs/atLeastZero",
                maximum: 10,
                $defs: { atLeastZero: { minimum: 0 } },
            };
            accepts(schema, 5);
            rejects(schema, -1);
            rejects(schema, 11);
        });

        it("resolves an empty $ref to the current resource root", () => {
            const schema = {
                type: "object",
                properties: {
                    child: { $ref: "" },
                },
            };
            accepts(schema, { child: {} });
            rejects(schema, { child: 5 });
        });
    });

    describe("JSON pointer edge cases", () => {
        it("unescapes ~0 (tilde) in pointer tokens", () => {
            const schema = {
                $ref: "#/$defs/tilde~0field",
                $defs: { "tilde~field": { type: "integer" } },
            };
            accepts(schema, 1);
            rejects(schema, "x");
        });

        it("unescapes ~1 (slash) in pointer tokens", () => {
            const schema = {
                $ref: "#/$defs/slash~1field",
                $defs: { "slash/field": { type: "integer" } },
            };
            accepts(schema, 1);
            rejects(schema, "x");
        });

        it("percent-decodes the fragment before pointer evaluation", () => {
            const schema = {
                $ref: "#/$defs/percent%25field",
                $defs: { "percent%field": { type: "integer" } },
            };
            accepts(schema, 1);
            rejects(schema, "x");
        });

        it("percent-decodes quotes in the fragment", () => {
            const schema = {
                $ref: "#/$defs/foo%22bar",
                $defs: { 'foo"bar': { type: "integer" } },
            };
            accepts(schema, 1);
            rejects(schema, "x");
        });

        it("keeps empty pointer tokens", () => {
            const schema = {
                $ref: "#/$defs//$defs/",
                $defs: { "": { $defs: { "": { type: "number" } } } },
            };
            accepts(schema, 1);
            rejects(schema, "x");
        });

        it("resolves pointers into properties", () => {
            const schema = {
                type: "object",
                properties: {
                    foo: { type: "string" },
                    bar: { $ref: "#/properties/foo" },
                },
            };
            accepts(schema, { bar: "ok" });
            rejects(schema, { bar: 3 });
        });

        it("resolves pointers into prefixItems", () => {
            const schema = {
                type: "object",
                properties: {
                    tuple: { type: "array", prefixItems: [{ type: "integer" }] },
                    same: { $ref: "#/properties/tuple/prefixItems/0" },
                },
            };
            accepts(schema, { same: 5 });
            rejects(schema, { same: "x" });
        });

        it("resolves pointers with array indices", () => {
            const schema = {
                $ref: "#/$defs/list/1",
                $defs: { list: [{ type: "string" }, { type: "integer" }] },
            };
            accepts(schema, 5);
            rejects(schema, "x");
        });
    });

    describe("boolean schema targets", () => {
        it("treats a ref to true as always-valid", () => {
            const schema = {
                $ref: "#/$defs/anything",
                $defs: { anything: true },
            };
            accepts(schema, 5);
            accepts(schema, { any: "thing" });
        });

        it("treats a ref to false as always-invalid", () => {
            const schema = {
                $ref: "#/$defs/nothing",
                $defs: { nothing: false },
            };
            rejects(schema, 5);
            rejects(schema, {});
        });
    });

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
            accepts(schema, { value: 1, next: { value: 2, next: { value: 3 } } });
            rejects(schema, { value: 1, next: { value: "two" } });
            rejects(schema, { value: 1, next: { next: { value: 3 } } });
            rejects(schema, { value: 1, next: { value: 2, extra: true } });

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

        it("validates mutually recursive definitions", () => {
            const schema = {
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
            };
            accepts(schema, { children: [{ children: [] }] });
            rejects(schema, { children: [{ children: [5] }] });
        });

        it("enforces a root pointer ref through additionalProperties", () => {
            const schema = {
                properties: { foo: { $ref: "#" } },
                additionalProperties: false,
            };
            accepts(schema, { foo: false });
            accepts(schema, { foo: { foo: false } });
            rejects(schema, { bar: false });
            rejects(schema, { foo: { bar: false } });
        });
    });

    describe("unresolvable references stay permissive", () => {
        it("ignores refs to unknown anchors", () => {
            accepts({ $ref: "#nope", $defs: { a: { $anchor: "yes" } } }, 5);
        });

        it("ignores refs to unknown remote documents", () => {
            accepts({ $ref: "http://example.com/other.json" }, 5);
            accepts({ $ref: "http://example.com/other.json#/foo" }, "x");
        });

        it("ignores refs with dangling pointers", () => {
            accepts({ $ref: "#/$defs/missing", $defs: { a: { type: "integer" } } }, "x");
            accepts({ $ref: "#/$defs/a/9", $defs: { a: [{ type: "integer" }] } }, "x");
            accepts({ $ref: "#/$defs/a/01", $defs: { a: [{ type: "integer" }] } }, "x");
            accepts({ $ref: "#/$defs/a/0/x", $defs: { a: [5] } }, "x");
        });

        it("ignores refs whose pointer lands on a non-schema value", () => {
            accepts({ $ref: "#/$defs/a/type", $defs: { a: { type: "integer" } } }, {});
            // The sibling allOf still applies; the ref to the array is ignored.
            accepts({ $ref: "#/allOf", allOf: [{ type: "integer" }] }, 5);
        });

        it("ignores syntactically invalid refs", () => {
            accepts({ $ref: "http://" }, 5);
        });

        it("ignores refs with malformed percent-encoding in the fragment", () => {
            accepts({ $ref: "#/$defs/%ZZ", $defs: { "%ZZ": { type: "integer" } } }, "x");
        });

        it("ignores refs inside nodes at non-schema locations", () => {
            // $defs values must be schemas; an array there is not walked, so
            // the node inside it has no base URI and its ref stays permissive.
            const schema = {
                $ref: "#/$defs/list/0",
                $defs: {
                    list: [{ $ref: "#/$defs/other" }],
                    other: { type: "string" },
                },
            };
            accepts(schema, 5);
            accepts(schema, "x");
        });

        it("ignores a pure self-referential cycle", () => {
            accepts({ $ref: "#" }, 5);
            accepts({ $ref: "#" }, { any: "thing" });
        });

        it("ignores a pure two-node ref cycle", () => {
            const schema = {
                $ref: "#/$defs/a",
                $defs: {
                    a: { $ref: "#/$defs/b" },
                    b: { $ref: "#/$defs/a" },
                },
            };
            accepts(schema, 5);
            accepts(schema, "anything");
        });

        it("keeps constraints of cycle members outside the dropped refs", () => {
            const schema = {
                $ref: "#/$defs/a",
                $defs: {
                    a: { type: "integer", $ref: "#/$defs/b" },
                    b: { $ref: "#/$defs/a" },
                },
            };
            accepts(schema, 5);
            rejects(schema, "x");
        });

        it("ignores a non-reference $ref-like value", () => {
            accepts({ $ref: 5, $defs: { a: { type: "integer" } } } as any, "x");
        });
    });

    describe("$id base URI resolution", () => {
        it("resolves refs against the nearest parent $id", () => {
            const schema = {
                $id: "http://example.com/a.json",
                $defs: {
                    x: {
                        $id: "http://example.com/b/c.json",
                        not: {
                            $defs: {
                                y: { $id: "d.json", type: "number" },
                            },
                        },
                    },
                },
                allOf: [{ $ref: "http://example.com/b/d.json" }],
            };
            accepts(schema, 1);
            rejects(schema, "a");
        });

        it("resolves relative refs against the root $id", () => {
            const schema = {
                $id: "http://example.com/root.json",
                $ref: "other.json",
                $defs: {
                    other: { $id: "other.json", type: "integer" },
                },
            };
            accepts(schema, 5);
            rejects(schema, "x");
        });

        it("resolves fragment refs within embedded resources", () => {
            const schema = {
                $id: "http://example.com/root.json",
                type: "object",
                properties: {
                    foo: {
                        $id: "nested.json",
                        $defs: { inner: { type: "string" } },
                        $ref: "#/$defs/inner",
                    },
                },
            };
            accepts(schema, { foo: "ok" });
            rejects(schema, { foo: 5 });
        });

        it("resolves absolute-path references against the base", () => {
            const schema = {
                $id: "http://example.com/ref/absref.json",
                $defs: {
                    a: { $id: "http://example.com/absref/foobar.json", type: "string" },
                },
                $ref: "/absref/foobar.json",
            };
            accepts(schema, "x");
            rejects(schema, 5);
        });

        it("ignores an invalid $id and keeps the parent base", () => {
            const schema = {
                $id: "not a valid uri  ",
                $ref: "#/$defs/a",
                $defs: { a: { type: "integer" } },
            };
            accepts(schema, 5);
        });

        it("ignores a non-string $id", () => {
            const schema = {
                $id: 5,
                $ref: "#/$defs/a",
                $defs: { a: { type: "integer" } },
            };
            accepts(schema, 5);
            rejects(schema, "x");
        });

        it("strips fragments from $id values", () => {
            const schema = {
                $id: "http://example.com/root.json#",
                $ref: "http://example.com/root.json#/$defs/a",
                $defs: { a: { type: "integer" } },
            };
            accepts(schema, 5);
            rejects(schema, "x");
        });

        it("resolves file: URI bases", () => {
            const schema = {
                $id: "file:///folder/file.json",
                $defs: { foo: { $id: "other.json", type: "number" } },
                $ref: "file:///folder/other.json",
            };
            accepts(schema, 1);
            rejects(schema, "x");
        });
    });

    describe("$anchor", () => {
        it("resolves anchors in the same resource", () => {
            const schema = {
                $ref: "#foo",
                $defs: { a: { $anchor: "foo", type: "integer" } },
            };
            accepts(schema, 1);
            rejects(schema, "x");
        });

        it("resolves anchors in an embedded resource", () => {
            const schema = {
                $id: "http://example.com/root.json",
                $ref: "http://example.com/nested.json#foo",
                $defs: {
                    a: {
                        $id: "nested.json",
                        $defs: { b: { $anchor: "foo", type: "integer" } },
                    },
                },
            };
            accepts(schema, 1);
            rejects(schema, "x");
        });

        it("scopes identical anchor names to their resources", () => {
            const schema = {
                $id: "http://example.com/foobar",
                $defs: {
                    a: {
                        $id: "child1",
                        allOf: [
                            { $id: "child2", $anchor: "my_anchor", type: "number" },
                            { $anchor: "my_anchor", type: "string" },
                        ],
                    },
                },
                $ref: "child1#my_anchor",
            };
            accepts(schema, "a");
            rejects(schema, 1);
        });

        it("ignores non-string anchors", () => {
            const schema = {
                $ref: "#5",
                $defs: { a: { $anchor: 5, type: "integer" } },
            };
            accepts(schema, "x");
        });
    });

    describe("URN base URIs", () => {
        it("resolves a $ref via a URN $id", () => {
            const schema = {
                $id: "urn:uuid:deadbeef-1234-ffff-ffff-4321feebdaed",
                properties: {
                    foo: { $ref: "urn:uuid:deadbeef-1234-ffff-ffff-4321feebdaed" },
                },
                additionalProperties: false,
            };
            accepts(schema, { foo: { foo: {} } });
            rejects(schema, { foo: { bar: {} } });
        });

        it("resolves a URN base with a JSON pointer fragment", () => {
            const schema = {
                $id: "urn:uuid:deadbeef-1234-0000-0000-4321feebdaed",
                properties: { foo: { $ref: "#/$defs/bar" } },
                $defs: { bar: { type: "string" } },
            };
            accepts(schema, { foo: "x" });
            rejects(schema, { foo: 5 });
        });

        it("resolves a URN ref with an anchor fragment", () => {
            const schema = {
                $id: "urn:uuid:deadbeef-1234-ff00-00ff-4321feebdaed",
                properties: {
                    foo: {
                        $ref: "urn:uuid:deadbeef-1234-ff00-00ff-4321feebdaed#something",
                    },
                },
                $defs: { bar: { $anchor: "something", type: "string" } },
            };
            accepts(schema, { foo: "x" });
            rejects(schema, { foo: 5 });
        });

        it("stays permissive when a relative ref cannot resolve against a URN base", () => {
            const schema = {
                $id: "urn:uuid:deadbeef-1234-0000-0000-4321feebdaed",
                $ref: "some-relative-thing",
                $defs: { bar: { type: "string" } },
            };
            accepts(schema, 5);
        });
    });

    describe("$dynamicRef static fallback", () => {
        it("resolves $dynamicRef to a $dynamicAnchor like a static anchor", () => {
            const schema = {
                type: "array",
                items: { $dynamicRef: "#items" },
                $defs: { foo: { $dynamicAnchor: "items", type: "string" } },
            };
            accepts(schema, ["a", "b"]);
            rejects(schema, ["a", 1]);
        });

        it("resolves $dynamicRef to a plain $anchor", () => {
            const schema = {
                type: "array",
                items: { $dynamicRef: "#items" },
                $defs: { foo: { $anchor: "items", type: "string" } },
            };
            accepts(schema, ["a"]);
            rejects(schema, [1]);
        });

        it("resolves $ref to a $dynamicAnchor", () => {
            const schema = {
                type: "array",
                items: { $ref: "#items" },
                $defs: { foo: { $dynamicAnchor: "items", type: "string" } },
            };
            accepts(schema, ["a"]);
            rejects(schema, [1]);
        });

        it("resolves $dynamicRef with a pointer fragment like $ref", () => {
            const schema = {
                properties: {
                    "true": { $dynamicRef: "#/$defs/true" },
                    "false": { $dynamicRef: "#/$defs/false" },
                },
                $defs: { "true": true, "false": false },
            };
            accepts(schema, { true: 1 });
            rejects(schema, { false: 1 });
        });

        it("applies both $ref and $dynamicRef when present", () => {
            const schema = {
                $ref: "#/$defs/a",
                $dynamicRef: "#/$defs/b",
                $defs: {
                    a: { minimum: 0 },
                    b: { maximum: 10 },
                },
            };
            accepts(schema, 5);
            rejects(schema, -1);
            rejects(schema, 11);
        });
    });

    describe("data is never treated as schema", () => {
        it("does not resolve a property named $ref", () => {
            const schema = {
                properties: { $ref: { type: "string" } },
            };
            accepts(schema, { $ref: "a" });
            rejects(schema, { $ref: 5 });
        });

        it("does not walk into enum members", () => {
            const schema = {
                $ref: "#/$defs/a",
                $defs: {
                    a: {
                        enum: [{ $ref: "#/$defs/b" }, 5],
                    },
                    b: { type: "string" },
                },
            };
            accepts(schema, 5);
            accepts(schema, { $ref: "#/$defs/b" });
            rejects(schema, 6);
        });

        it("does not walk into const values", () => {
            const schema = {
                const: { $id: "http://example.com/x.json", $anchor: "boom" },
            };
            accepts(schema, { $id: "http://example.com/x.json", $anchor: "boom" });
            rejects(schema, { $id: "http://example.com/x.json" });
        });
    });

    describe("interaction with existing pipelines", () => {
        it("keeps required-with-default raw-input presence checks", () => {
            const schema = {
                type: "object",
                properties: {
                    foo: { $ref: "#/$defs/withDefault" },
                },
                required: ["foo"],
                $defs: { withDefault: { type: "integer", default: 3 } },
            };
            accepts(schema, { foo: 1 });
            rejects(schema, {});
        });

        it("keeps __proto__ required handling", () => {
            const schema = {
                required: ["__proto__"],
                $defs: { a: { type: "integer" } },
            };
            const zodSchema = convertJsonSchemaToZod(schema as any);
            expect(zodSchema.safeParse(JSON.parse('{"__proto__": 1}')).success).toBe(true);
            expect(zodSchema.safeParse({}).success).toBe(false);
        });

        it("handles a required property that is a direct self-ref", () => {
            // Requiring the self-referencing property means only an infinite
            // chain could satisfy the schema, so all finite data is invalid.
            // The conversion itself must not crash or recurse forever, and
            // the build-time required-presence probe must stay safe.
            const schema = {
                type: "object",
                properties: { foo: { $ref: "#" } },
                required: ["foo"],
            };
            rejects(schema, { foo: { foo: {} } });
            rejects(schema, {});
            rejects(schema, { foo: 5 });
        });

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

    describe("conversion reuse", () => {
        it("converts the same document twice independently", () => {
            const schema = {
                $ref: "#/$defs/a",
                $defs: { a: { type: "integer" } },
            };
            const first = convertJsonSchemaToZod(schema);
            const second = convertJsonSchemaToZod(schema);
            expect(first.safeParse(5).success).toBe(true);
            expect(second.safeParse(5).success).toBe(true);
            expect(second.safeParse("x").success).toBe(false);
        });

        it("handles boolean schemas at the top level", () => {
            expect(convertJsonSchemaToZod(true).safeParse(1).success).toBe(true);
            expect(convertJsonSchemaToZod(false).safeParse(1).success).toBe(false);
        });

        it("resolves nothing outside an active conversion", () => {
            expect(convertSchemaRefs({ $ref: "#" } as any)).toEqual([]);
        });
    });
});
