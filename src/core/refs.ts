import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";

/**
 * A function that converts a single JSON Schema node to a Zod schema.
 */
export type ConvertFunction = (schema: JSONSchema.BaseSchema | boolean) => z.ZodTypeAny;

/**
 * Keys that never constrain a value by themselves. A schema whose keys are
 * all in this set is treated as unconstrained (converted to z.any()); any
 * reference keywords it carries are enforced separately by the RefHandler.
 */
export const NON_CONSTRAINT_KEYS: ReadonlySet<string> = new Set([
    "$schema",
    "title",
    "description",
    "$ref",
    "$dynamicRef",
    "$defs",
    "definitions",
    "$id",
    "$anchor",
    "$dynamicAnchor",
    "$comment",
    "$vocabulary",
]);

// Keywords whose value is a single subschema (or, for "items", possibly a
// draft-4 style array of subschemas).
const SINGLE_SCHEMA_KEYWORDS = [
    "items",
    "not",
    "if",
    "then",
    "else",
    "contains",
    "additionalProperties",
    "propertyNames",
    "unevaluatedItems",
    "unevaluatedProperties",
    "contentSchema",
];

// Keywords whose value is a map from names to subschemas.
const SCHEMA_MAP_KEYWORDS = ["properties", "patternProperties", "$defs", "definitions", "dependentSchemas"];

// Keywords whose value is an array of subschemas.
const SCHEMA_ARRAY_KEYWORDS = ["allOf", "anyOf", "oneOf", "prefixItems"];

// Reference keywords. $dynamicRef is resolved statically, like $ref.
const REF_KEYWORDS = ["$ref", "$dynamicRef"];

// Base URI assigned to documents whose root has no (valid) $id. Uses the
// reserved .invalid TLD so it cannot collide with a real identifier.
const DEFAULT_BASE_URI = "https://in-memory.zod-from-json-schema.invalid/root.json";

// Sentinel for references that cannot be resolved within the document.
const NOT_RESOLVED = Symbol("not-resolved");

/**
 * The result of statically analyzing a schema document for reference
 * resolution: per-node base URIs, embedded resource roots by canonical URI,
 * and anchors scoped to their containing resource.
 */
export interface DocumentAnalysis {
    baseUriByNode: WeakMap<object, string>;
    resourcesByUri: Map<string, object>;
    anchorsByUri: Map<string, object>;
}

interface ConversionContext {
    analysis: DocumentAnalysis;
    memo: Map<unknown, z.ZodTypeAny>;
    inFlight: Set<object>;
    convert: ConvertFunction;
}

let activeContext: ConversionContext | undefined;

/**
 * Reads an own property without going through the prototype chain or
 * triggering accessors, so hazardous names like "__proto__" are handled
 * safely.
 */
function getOwnValue(objectValue: object, key: string): unknown {
    const descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
    return descriptor === undefined ? undefined : descriptor.value;
}

function isSchemaObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveUri(reference: string, baseUri: string): string | undefined {
    try {
        return new URL(reference, baseUri).href;
    } catch {
        return undefined;
    }
}

function stripFragment(uri: string): string {
    const hashIndex = uri.indexOf("#");
    return hashIndex < 0 ? uri : uri.slice(0, hashIndex);
}

/**
 * Walks a schema document, assigning every schema node its base URI and
 * indexing embedded resources ($id) and anchors ($anchor/$dynamicAnchor).
 * Only positions known to hold schemas are walked; everything else (enum,
 * const, default, ...) is data and is never entered.
 * @param root The document root schema object
 * @returns The document analysis used for reference resolution
 */
export function analyzeDocument(root: object): DocumentAnalysis {
    const analysis: DocumentAnalysis = {
        baseUriByNode: new WeakMap(),
        resourcesByUri: new Map(),
        anchorsByUri: new Map(),
    };
    walkSchema(root, DEFAULT_BASE_URI, true, analysis, new Set());
    return analysis;
}

function walkSchema(
    node: unknown,
    baseUri: string,
    isRoot: boolean,
    analysis: DocumentAnalysis,
    seen: Set<object>,
): void {
    if (!isSchemaObject(node) || seen.has(node)) return;
    seen.add(node);

    let nodeBase = baseUri;
    const id = getOwnValue(node, "$id");
    if (typeof id === "string") {
        const resolved = resolveUri(id, baseUri);
        if (resolved !== undefined) {
            nodeBase = stripFragment(resolved);
            if (!analysis.resourcesByUri.has(nodeBase)) {
                analysis.resourcesByUri.set(nodeBase, node);
            }
        }
    }
    if (isRoot && !analysis.resourcesByUri.has(nodeBase)) {
        analysis.resourcesByUri.set(nodeBase, node);
    }
    analysis.baseUriByNode.set(node, nodeBase);

    for (const keyword of ["$anchor", "$dynamicAnchor"]) {
        const anchor = getOwnValue(node, keyword);
        if (typeof anchor === "string") {
            const anchorUri = `${nodeBase}#${anchor}`;
            if (!analysis.anchorsByUri.has(anchorUri)) {
                analysis.anchorsByUri.set(anchorUri, node);
            }
        }
    }

    for (const keyword of SINGLE_SCHEMA_KEYWORDS) {
        const value = getOwnValue(node, keyword);
        if (Array.isArray(value)) {
            // Draft-4 style array form (e.g. "items").
            for (const element of value) {
                walkSchema(element, nodeBase, false, analysis, seen);
            }
        } else {
            walkSchema(value, nodeBase, false, analysis, seen);
        }
    }
    for (const keyword of SCHEMA_MAP_KEYWORDS) {
        const map = getOwnValue(node, keyword);
        if (isSchemaObject(map)) {
            for (const key of Object.getOwnPropertyNames(map)) {
                walkSchema(getOwnValue(map, key), nodeBase, false, analysis, seen);
            }
        }
    }
    for (const keyword of SCHEMA_ARRAY_KEYWORDS) {
        const values = getOwnValue(node, keyword);
        if (Array.isArray(values)) {
            for (const element of values) {
                walkSchema(element, nodeBase, false, analysis, seen);
            }
        }
    }
}

/**
 * Evaluates a JSON pointer (already percent-decoded) against a raw document
 * node. Returns NOT_RESOLVED for dangling pointers or pointers that land on
 * something that is not a schema (object or boolean).
 */
function evaluatePointer(root: unknown, pointer: string): unknown {
    let current: unknown = root;
    for (const rawToken of pointer.split("/").slice(1)) {
        const token = rawToken.replace(/~1/g, "/").replace(/~0/g, "~");
        if (Array.isArray(current)) {
            if (!/^(?:0|[1-9][0-9]*)$/.test(token)) return NOT_RESOLVED;
            const index = Number(token);
            if (index >= current.length) return NOT_RESOLVED;
            current = current[index];
        } else if (typeof current === "object" && current !== null) {
            const descriptor = Object.getOwnPropertyDescriptor(current, token);
            if (descriptor === undefined) return NOT_RESOLVED;
            current = descriptor.value;
        } else {
            return NOT_RESOLVED;
        }
    }
    return isSchemaObject(current) || typeof current === "boolean" ? current : NOT_RESOLVED;
}

/**
 * Resolves a reference value from the given node against the document
 * analysis. Returns the raw target node, or NOT_RESOLVED when the reference
 * points outside the document or at nothing.
 */
function resolveReference(reference: string, node: object, analysis: DocumentAnalysis): unknown {
    const baseUri = analysis.baseUriByNode.get(node);
    if (baseUri === undefined) return NOT_RESOLVED;
    const resolved = resolveUri(reference, baseUri);
    if (resolved === undefined) return NOT_RESOLVED;

    const hashIndex = resolved.indexOf("#");
    const uri = hashIndex < 0 ? resolved : resolved.slice(0, hashIndex);
    const rawFragment = hashIndex < 0 ? "" : resolved.slice(hashIndex + 1);
    let fragment: string;
    try {
        fragment = decodeURIComponent(rawFragment);
    } catch {
        return NOT_RESOLVED;
    }

    if (fragment.startsWith("/")) {
        const resource = analysis.resourcesByUri.get(uri);
        if (resource === undefined) return NOT_RESOLVED;
        return evaluatePointer(resource, fragment);
    }
    if (fragment === "") {
        const resource = analysis.resourcesByUri.get(uri);
        return resource === undefined ? NOT_RESOLVED : resource;
    }
    const anchorNode = analysis.anchorsByUri.get(`${uri}#${fragment}`);
    return anchorNode === undefined ? NOT_RESOLVED : anchorNode;
}

/**
 * Checks whether following $ref/$dynamicRef edges from a resolved target
 * leads back to the referencing node. Such a cycle makes no progress on the
 * data (no applicator is crossed), so validation would recurse forever; the
 * reference is treated as unresolvable instead.
 */
function refChainReturnsTo(origin: object, firstTarget: unknown, analysis: DocumentAnalysis): boolean {
    const seen = new Set<object>();
    const pending: unknown[] = [firstTarget];
    while (pending.length > 0) {
        const current = pending.pop();
        if (current === origin) return true;
        if (!isSchemaObject(current) || seen.has(current)) continue;
        seen.add(current);
        for (const keyword of REF_KEYWORDS) {
            const referenceValue = getOwnValue(current, keyword);
            if (typeof referenceValue === "string") {
                const next = resolveReference(referenceValue, current, analysis);
                if (next !== NOT_RESOLVED) pending.push(next);
            }
        }
    }
    return false;
}

/**
 * Converts a schema through the active conversion context, memoizing results
 * per node and tracking in-flight nodes so recursive references can be
 * deferred instead of recursing forever.
 */
function convertMemoized(context: ConversionContext, schema: JSONSchema.BaseSchema | boolean): z.ZodTypeAny {
    if (typeof schema === "boolean") return context.convert(schema);
    const memoized = context.memo.get(schema);
    if (memoized !== undefined) return memoized;
    context.inFlight.add(schema);
    try {
        const result = context.convert(schema);
        context.memo.set(schema, result);
        return result;
    } finally {
        context.inFlight.delete(schema);
    }
}

/**
 * Builds a schema that validates against the referenced node's converted
 * schema, looked up at parse time. Used for references to nodes whose
 * conversion is still in flight (recursive references); by the time data is
 * parsed, the memo entry exists. While conversion is still in progress
 * (e.g. build-time probes by other handlers) the check is permissive.
 */
function deferredSchema(memo: Map<unknown, z.ZodTypeAny>, node: object): z.ZodTypeAny {
    return z.any().refine(
        (value) => {
            const converted = memo.get(node);
            return converted === undefined || converted.safeParse(value).success;
        },
        { message: "Value does not match referenced schema" },
    );
}

/**
 * Entry point for all schema conversion. Installs a conversion context for
 * the outermost call (treating the argument as the document root) and reuses
 * the active context for nested calls made by handlers, so every node in a
 * document is analyzed, memoized, and reference-resolvable.
 * @param schema The schema (or subschema, for nested calls) to convert
 * @param convert The context-free single-node conversion function
 * @returns The converted Zod schema
 */
export function runConversion(schema: JSONSchema.BaseSchema | boolean, convert: ConvertFunction): z.ZodTypeAny {
    if (activeContext !== undefined) {
        return convertMemoized(activeContext, schema);
    }
    if (typeof schema === "boolean") return convert(schema);
    const context: ConversionContext = {
        analysis: analyzeDocument(schema),
        memo: new Map(),
        inFlight: new Set(),
        convert,
    };
    activeContext = context;
    try {
        return convertMemoized(context, schema);
    } finally {
        activeContext = undefined;
    }
}

/**
 * Resolves and converts the $ref/$dynamicRef targets of a schema node
 * against the active conversion context. Unresolvable references (unknown
 * URIs, dangling pointers, unknown anchors, no-progress reference cycles, or
 * no active context) are omitted, preserving permissive behavior.
 * @param schema The schema node whose references should be converted
 * @returns Converted Zod schemas for each resolvable reference target
 */
export function convertSchemaRefs(schema: JSONSchema.BaseSchema): z.ZodTypeAny[] {
    const context = activeContext;
    if (context === undefined) return [];
    const converted: z.ZodTypeAny[] = [];
    for (const keyword of REF_KEYWORDS) {
        const referenceValue = getOwnValue(schema, keyword);
        if (typeof referenceValue !== "string") continue;
        const target = resolveReference(referenceValue, schema, context.analysis);
        if (target === NOT_RESOLVED) continue;
        if (refChainReturnsTo(schema, target, context.analysis)) continue;
        if (isSchemaObject(target) && context.inFlight.has(target)) {
            converted.push(deferredSchema(context.memo, target));
        } else {
            converted.push(convertMemoized(context, target as JSONSchema.BaseSchema | boolean));
        }
    }
    return converted;
}
