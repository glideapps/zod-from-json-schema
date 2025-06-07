# Known Limitations

This document lists known limitations of the JSON Schema to Zod converter.

## 1. `__proto__` Property Validation

**Issue**: JSON schemas that require a property named `__proto__` cannot be properly validated.

**Reason**: Zod strips the `__proto__` property from all parsed objects as a security measure to prevent prototype pollution attacks. This happens at the parsing level before any validation logic can run.

**Example**:
```json
{
  "required": ["__proto__"],
  "properties": {
    "__proto__": { "type": "string" }
  }
}
```

**Impact**: Objects with a `__proto__` property will fail validation even if they should be valid according to the JSON schema.

**Workaround**: None. This is a fundamental security feature of Zod that cannot be disabled.

## 2. Unicode Grapheme Cluster Counting

**Issue**: The `maxLength` constraint for strings counts UTF-16 code units rather than Unicode grapheme clusters.

**Reason**: JavaScript's string length property counts UTF-16 code units. Proper grapheme cluster counting would require additional libraries.

**Example**: The string "👍🏽" (thumbs up with skin tone) is counted as 4 characters instead of 1 grapheme cluster.

**Impact**: Strings with emoji, combining characters, or other complex Unicode may not validate as expected.

**Workaround**: Use a custom refinement with a proper Unicode library if exact grapheme cluster counting is required.

## 3. Tuple Array Schema Conversion

**Issue**: When converting tuple arrays (using `items` as an array or `prefixItems`) back to JSON Schema using `z.toJSONSchema()`, the resulting schema may not maintain the exact tuple structure.

**Reason**: The modular architecture uses refinements to validate tuple constraints rather than Zod's native tuple types, which affects round-trip conversion.

**Example**:
```json
{
  "type": "array",
  "items": [
    { "type": "string" },
    { "type": "number" }
  ]
}
```

**Impact**: While validation works correctly, converting the Zod schema back to JSON Schema may produce a different but functionally equivalent structure.

**Workaround**: None needed for validation purposes. This only affects schema introspection and round-trip conversion.