import { z } from "zod/v4";

/**
 * Simple deep equality check for validation purposes
 */
export function deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b) return false;
    
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        return a.every((item, index) => deepEqual(item, b[index]));
    }
    
    if (typeof a === 'object' && typeof b === 'object') {
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        return keysA.every(key => keysB.includes(key) && deepEqual(a[key], b[key]));
    }
    
    return false;
}

/**
 * Creates a uniqueItems validation function
 */
export function createUniqueItemsValidator() {
    return (value: any) => {
        if (!Array.isArray(value)) {
            return true;
        }

        const seen: any[] = [];
        return value.every((item: any) => {
            const isDuplicate = seen.some((seenItem: any) => deepEqual(item, seenItem));
            if (isDuplicate) {
                return false;
            }
            seen.push(item);
            return true;
        });
    };
}

/**
 * Validates a value against a Zod schema
 */
export function isValidWithSchema(schema: z.ZodTypeAny, value: any): boolean {
    return schema.safeParse(value).success;
}

/**
 * Checks whether a property name collides with a member of Object.prototype
 * (e.g. "toString", "constructor", "__proto__"). Such names cannot be
 * validated through a plain z.object() shape: when the key is absent, Zod
 * reads the inherited value off the prototype chain instead of treating the
 * property as missing. These properties are validated with own-property
 * semantics in ObjectPropertiesHandler instead.
 */
export function isHazardousPropertyName(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(Object.prototype, name);
}

/**
 * Conservatively detects whether a keyword's configuration could make
 * validation sensitive to an instance's own "__proto__" key. Zod strips own
 * "__proto__" keys from object parse output for security, so a refinement
 * with such a configuration must run against the raw input to keep
 * own-property semantics; all other refinements run on the parse output,
 * which keeps their base schema's structure visible to z.toJSONSchema.
 *
 * Matching any occurrence of the string "__proto__" — object key, array
 * element, or plain string value — is deliberate over-approximation. In
 * dependentRequired, every string in the configuration (entry key or
 * dependent name) is a property name that gets an own-property check, so
 * value matches are meaningful there. In dependentSchemas, "__proto__" can
 * matter in positions a precise walk cannot enumerate: a subschema's
 * "required" array, nested "properties"/"dependentRequired" keys, even keys
 * inside a "const" value compared structurally. A false positive (e.g.
 * {"const": "__proto__"}) is safe: it only switches the check to the raw
 * input, which is always at least as correct, at the cost of hiding the
 * base schema's structure from z.toJSONSchema's "input" io for that one
 * schema.
 */
export function mayDependOnProtoKey(value: unknown): boolean {
    try {
        return JSON.stringify(value).includes('"__proto__"');
    } catch {
        // Unstringifiable (e.g. circular) configuration: assume the worst so
        // validation stays correct.
        return true;
    }
}