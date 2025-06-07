# JSON Schema to Zod Converter Architecture

## Overview

This document describes the modular architecture for converting JSON Schema to Zod schemas. The architecture reflects JSON Schema's compositional nature, where each property adds independent constraints that combine to form the complete validation.

## Core Concepts

### Two-Phase Processing

The converter operates in two distinct phases:

1. **Type-Specific Phase**: Handlers that work with specific types (string, number, etc.) and can apply Zod's built-in constraints
2. **Refinement Phase**: Handlers that add custom validation logic through Zod's `.refine()` method

### Type Schemas

During the first phase, we maintain a `TypeSchemas` object that tracks the state of each possible type:

```typescript
interface TypeSchemas {
  string?: z.ZodString | false;
  number?: z.ZodNumber | false;  // integers are numbers with .int() constraint
  boolean?: z.ZodBoolean | false;
  null?: z.ZodNull | false;
  array?: z.ZodArray<any> | false;
  object?: z.ZodObject<any> | false;
}
```

Each type can be in one of three states:
- `undefined`: Type is still allowed (no constraints have excluded it)
- `false`: Type is explicitly disallowed
- `z.Zod*`: Type with accumulated constraints

## Architecture Components

### 1. Primitive Handlers

These handlers operate during the first phase and modify the `TypeSchemas`:

```typescript
interface PrimitiveHandler {
  apply(types: TypeSchemas, schema: JSONSchema): void;
}
```

Examples:
- **TypeHandler**: Sets types to `false` if not in the `type` array
- **MinimumHandler**: Applies `.min()` to number if still allowed
- **PatternHandler**: Applies `.regex()` to string if still allowed
- **MinLengthHandler**: Applies `.min()` to string if still allowed
- **ItemsHandler**: Configures array element validation if arrays still allowed

### 2. Refinement Handlers

These handlers operate during the second phase on the combined schema:

```typescript
interface RefinementHandler {
  apply(zodSchema: z.ZodTypeAny, schema: JSONSchema): z.ZodTypeAny;
}
```

Examples:
- **UniqueItemsHandler**: Adds custom validation for array uniqueness
- **NotHandler**: Adds validation that value must not match a schema
- **MultipleOfHandler**: Adds custom number divisibility check (if not using Zod's built-in)

## Processing Flow

### Phase 1: Type-Specific Constraints

1. Initialize empty `TypeSchemas` object
2. Run all primitive handlers in sequence
3. Each handler:
   - Checks if it has relevant constraints in the schema
   - For each type it affects, checks if that type is still allowed (`!== false`)
   - If allowed and constraint applies, either:
     - Creates initial type schema if `undefined`
     - Adds constraints to existing type schema

### Phase 2: Build Union and Apply Refinements

1. Convert remaining `undefined` types to their most permissive schemas:
   - `string` → `z.string()`
   - `number` → `z.number()`
   - `array` → `z.array(z.any())`
   - `object` → `z.object({}).passthrough()`
   - etc.

2. Filter out `false` types and create union of allowed types:
   - 0 types → `z.never()`
   - 1 type → that type's schema
   - 2+ types → `z.union([...])`

3. Run all refinement handlers on the resulting schema

## Example: Processing a Complex Schema

Given this JSON Schema:
```json
{
  "type": ["string", "number"],
  "minimum": 5,
  "minLength": 3,
  "pattern": "^[A-Z]",
  "uniqueItems": true
}
```

**Phase 1 (Primitive Handlers):**
1. TypeHandler: marks `boolean`, `null`, `array`, `object` as `false`
2. MinimumHandler: sets `number` to `z.number().min(5)`
3. MinLengthHandler: sets `string` to `z.string().min(3)`
4. PatternHandler: updates `string` to `z.string().min(3).regex(/^[A-Z]/)`

**Result after Phase 1:**
```typescript
{
  string: z.string().min(3).regex(/^[A-Z]/),
  number: z.number().min(5),
  boolean: false,
  null: false,
  array: false,
  object: false
}
```

**Phase 2:**
1. Create union: `z.union([z.string().min(3).regex(/^[A-Z]/), z.number().min(5)])`
2. UniqueItemsHandler: Adds refinement (only validates for arrays, but none allowed here)

## Benefits

1. **Modularity**: Each JSON Schema keyword is handled by a dedicated handler
2. **Composability**: Handlers don't need to know about each other
3. **Type Safety**: Type-specific constraints are only applied to appropriate types
4. **Extensibility**: New keywords can be supported by adding new handlers
5. **Maintainability**: Clear separation between constraint types
6. **Correctness**: Reflects JSON Schema's additive constraint model

## Implementation Guidelines

### Adding a New Primitive Handler

1. Determine which type(s) the constraint affects
2. Create handler that checks if those types are still allowed
3. Apply constraints using Zod's built-in methods where possible

### Adding a New Refinement Handler

1. Use for constraints that:
   - Apply across multiple types
   - Require custom validation logic
   - Can't be expressed with Zod's built-in constraints
2. Handler receives the complete schema after type union
3. Return schema with added `.refine()` validation

### Handler Order

- Primitive handlers can run in any order (they're independent)
- Refinement handlers should be ordered by complexity/dependencies
- Metadata handlers (description, examples) should run last