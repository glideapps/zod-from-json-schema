# JSON validation fixtures

Validation-only tests do not need a TypeScript test file. Add one schema and
one or more JSON inputs whose names share a base:

```text
tests/contains/
  basic.schema.json
  basic.pass.has-match.json
  basic.fail.no-match.json
```

The runner recursively discovers these files using this convention:

- `<name>.schema.json` is passed to `convertJsonSchemaToZod`.
- `<name>.pass.<case-id>.json` must validate successfully.
- `<name>.fail.<case-id>.json` must fail validation.

Case IDs may contain ASCII letters, numbers, underscores, and hyphens. Use a
short descriptive ID when practical; numeric IDs are also valid.

Each schema must have at least one case. Every pass/fail file must have a
matching schema in the same directory. Malformed JSON, orphaned cases, empty
schema groups, and unrecognized `.json` filenames fail the suite with the
offending path.

Run only these fixtures with:

```bash
npm run test:fixtures
```

Keep TypeScript tests when they inspect generated Zod structure, assert parsed
output or defaults, exercise internal helpers, use values JSON cannot encode,
or construct recursive inputs programmatically.
