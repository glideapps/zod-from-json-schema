# zod-from-json-schema Examples

This directory contains examples showing how to use zod-from-json-schema in both CommonJS and ESM environments.

## Running the examples

To run the CommonJS example:

```bash
node cjs-example.cjs
```

To run the ESM example:

```bash
node esm-example.mjs
```

## Notes

- The CommonJS example uses `.cjs` extension and `require()` syntax
- The ESM example uses `.mjs` extension and `import` syntax
- Both examples import directly from the local build in `../dist/`
- When using in your own project, you would import from `zod-from-json-schema` instead