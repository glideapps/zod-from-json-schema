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